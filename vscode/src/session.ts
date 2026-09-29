// A page of the app bound to a project document: the full diagram editor (editor.ts), the preview
// beside its text (preview.ts), or a tool panel of the side bar (sidebar.ts), which follows the active
// project document. The TextDocument is the source of truth: the page sends the new text after each
// change of the project, and changes of the text made elsewhere (text editor, undo, file on disk,
// another page) are sent to the page. Selections go from page to page by data path of the file.
import * as vscode from 'vscode'
import { lineOfPath } from '../../src/renderer/src/model/serialize'
import { webviewHtml } from './html'
import type {
  DiagramAction,
  OutputDirReply,
  OutputFileReply,
  SidePanel,
  ToHost,
  ToPage,
  WebviewInit,
  WebviewMode
} from './protocol'

/** Full diagram editor (custom editor). */
export const VIEW_TYPE = 'projectScaffold.editor'
/** Diagram preview beside the text. */
export const PREVIEW_TYPE = 'projectScaffold.preview'
/** Files whose text editor offers the preview (see package.json). */
export const PROJECT_FILE = /\.scaffold\.(ya?ml|json)$/i

/** Context keys: a diagram has the keyboard focus (its shortcuts win, see package.json); is active. */
const FOCUS_CONTEXT = 'projectScaffold.focused'
const ACTIVE_CONTEXT = 'projectScaffold.diagramActive'
/** Global state key of the page preferences (settings, panel layout, recent commands). */
const STORAGE_KEY = 'storage'

type DataPath = (string | number)[]

/** Messages handled in the order they come (see Sessions.open). */
const ORDERED = new Set<ToHost['type']>(['edit', 'save', 'undo', 'redo', 'selected'])

/** Whether the text cursor and the diagram selection follow each other. */
export const syncSelection = (): boolean =>
  vscode.workspace.getConfiguration('projectScaffold').get<boolean>('syncSelection', true)

/** Smallest edit turning the document text into `text`: what lies between their common ends. */
function minimalEdit(document: vscode.TextDocument, text: string): vscode.TextEdit {
  const before = document.getText()
  const max = Math.min(before.length, text.length)
  let start = 0
  while (start < max && before[start] === text[start]) start++
  let end = 0
  while (end < max - start && before[before.length - 1 - end] === text[text.length - 1 - end]) end++
  // Never split a surrogate pair.
  const surrogate = (i: number, low: number): boolean => {
    const c = before.charCodeAt(i)
    return c >= low && c <= low + 0x3ff
  }
  if (start > 0 && surrogate(start - 1, 0xd800)) start--
  if (end > 0 && surrogate(before.length - end, 0xdc00)) end--
  const range = new vscode.Range(document.positionAt(start), document.positionAt(before.length - end))
  return vscode.TextEdit.replace(range, text.slice(start, text.length - end))
}

const sibling = (uri: vscode.Uri, file: string): vscode.Uri => vscode.Uri.joinPath(uri, '..', file)

/** Project files of the workspace (but `current`), else any file through the open dialog. The quick
 *  pick stays open when the page takes the focus back (a click in a webview does, after the fact). */
async function pickProjectFile(current: vscode.Uri): Promise<vscode.Uri | undefined> {
  const files = await vscode.workspace.findFiles('**/*.scaffold.{yaml,yml,json}', '**/node_modules/**')
  const items: (vscode.QuickPickItem & { uri?: vscode.Uri })[] = files
    .filter((uri) => uri.toString() !== current.toString())
    .map((uri) => ({
      label: uri.path.split('/').pop() ?? uri.path,
      description: vscode.workspace.asRelativePath(vscode.Uri.joinPath(uri, '..')),
      uri
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  items.push({ label: '$(folder-opened) Browse…', description: 'any project file' })
  const picked = await vscode.window.showQuickPick(items, {
    title: 'Project file',
    placeHolder: 'Project file to read',
    matchOnDescription: true,
    ignoreFocusOut: true
  })
  if (!picked || picked.uri) return picked?.uri
  const [uri] =
    (await vscode.window.showOpenDialog({
      defaultUri: sibling(current, '.'),
      filters: { 'Project files': ['yaml', 'yml', 'json'] },
      title: 'Project file'
    })) ?? []
  return uri
}

const EXPORT_FILTERS: Record<string, Record<string, string[]>> = {
  yaml: { YAML: ['yaml', 'yml'] },
  yml: { YAML: ['yaml', 'yml'] },
  json: { JSON: ['json'] },
  png: { 'PNG image': ['png'] },
  svg: { 'SVG image': ['svg'] }
}

export class DiagramSession {
  /** Text the page wrote last: its change event is not sent back. */
  private written: string | undefined

  constructor(
    readonly panel: vscode.WebviewPanel | vscode.WebviewView,
    /** Document shown; a side panel changes it, and may have none. */
    public uri: vscode.Uri | undefined,
    readonly mode: WebviewMode,
    private readonly sessions: Sessions
  ) {}

  /** A diagram (not a side panel) in the active editor group. */
  get active(): boolean {
    return this.mode !== 'panel' && 'active' in this.panel && this.panel.active
  }

  /** Whether the page shows this document. */
  shows(uri: vscode.Uri | undefined): boolean {
    return !!uri && this.uri?.toString() === uri.toString()
  }

  /** The document, opened again when it was closed meanwhile. */
  document(): Thenable<vscode.TextDocument> {
    if (!this.uri) throw new Error('No project document')
    return vscode.workspace.openTextDocument(this.uri)
  }

  post(msg: ToPage): Thenable<boolean> {
    return this.panel.webview.postMessage(msg)
  }

  /** The document text changed. */
  changed(text: string): void {
    const own = text === this.written
    this.written = undefined
    if (!own) void this.post({ type: 'update', text })
  }

  /** Side panel: shows another document (or none). */
  async show(uri: vscode.Uri | undefined): Promise<void> {
    this.uri = uri
    this.written = undefined
    const document = uri && (await vscode.workspace.openTextDocument(uri))
    await this.post({ type: 'document', ...documentInit(document) })
    const view = uri && this.sessions.viewOf(uri)
    if (view !== undefined) await this.post({ type: 'view', view })
  }

  async receive(msg: ToHost): Promise<void> {
    // Messages that need no document.
    switch (msg.type) {
      case 'focus':
        await vscode.commands.executeCommand('setContext', FOCUS_CONTEXT, msg.focused)
        return
      case 'storage':
        return this.sessions.store(this, msg.key, msg.value)
      case 'showPanel':
        await vscode.commands.executeCommand(`${sidePanelId(msg.panel)}.focus`)
        return
      case 'ready':
        return this.sessions.ready(this)
    }
    if (!this.uri) return
    const document = await this.document()
    const reply = (id: number, result: unknown): Thenable<boolean> => this.post({ type: 'reply', id, result })
    switch (msg.type) {
      case 'edit': {
        // A side panel may have switched document since: the edit goes to the one it names.
        const own = msg.uri === document.uri.toString()
        const target = own ? document : await vscode.workspace.openTextDocument(vscode.Uri.parse(msg.uri))
        if (msg.text === target.getText()) return
        if (own) this.written = msg.text
        const edit = new vscode.WorkspaceEdit()
        edit.set(target.uri, [minimalEdit(target, msg.text)])
        await vscode.workspace.applyEdit(edit)
        return
      }
      case 'save':
        await document.save()
        return
      case 'undo':
      case 'redo':
        await vscode.commands.executeCommand(msg.type)
        return
      case 'selected':
        this.sessions.reveal(this, msg.path)
        return this.showInText(document, msg.path)
      case 'view':
        return this.sessions.viewChanged(this, msg.view)
      case 'inDiagram':
        return this.sessions.inDiagram(this, msg.action)
      case 'export': {
        const ext = msg.name.split('.').pop() ?? ''
        const uri = await vscode.window.showSaveDialog({
          defaultUri: sibling(this.uri, msg.name),
          filters: EXPORT_FILTERS[ext] ?? {},
          title: `Export ${ext.toUpperCase()}`
        })
        if (uri) {
          const bytes =
            msg.encoding === 'base64' ? Buffer.from(msg.data, 'base64') : new TextEncoder().encode(msg.data)
          await vscode.workspace.fs.writeFile(uri, bytes)
        }
        await reply(msg.id, uri ? vscode.workspace.asRelativePath(uri) : null)
        return
      }
      case 'openFile': {
        const uri = await pickProjectFile(this.uri)
        const content = uri ? new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)) : null
        await reply(msg.id, uri && content !== null ? { path: uri.fsPath, content } : null)
        return
      }
      case 'readSibling': {
        let content: string | null = null
        try {
          content = new TextDecoder().decode(await vscode.workspace.fs.readFile(sibling(this.uri, msg.file)))
        } catch {
          // Missing or unreadable: the page tells.
        }
        await reply(msg.id, content)
        return
      }
      case 'outputDir':
        await reply(msg.id, await this.sessions.outputDir(this.uri, msg.pick, msg.name))
        return
      case 'outputFile':
        await reply(msg.id, await this.sessions.outputFile(msg.dir, msg.path, msg.op, msg.text))
        return
      case 'openSibling': {
        // Opened the way this one is: full diagram, or text (its preview is a click away).
        const uri = sibling(this.uri, msg.file)
        if (this.mode === 'editor') await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE)
        else await vscode.commands.executeCommand('vscode.open', uri)
        return
      }
    }
  }

  /** Moves the cursor of the visible text editors of the document to the line of a data path. */
  private showInText(document: vscode.TextDocument, path: DataPath): void {
    if (!syncSelection()) return
    const editors = vscode.window.visibleTextEditors.filter((e) => e.document === document)
    if (!editors.length) return
    const found = lineOfPath(document.getText(), path)
    if (found === undefined) return
    const line = document.lineAt(Math.min(found, document.lineCount) - 1)
    const at = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex)
    for (const e of editors) {
      e.selection = new vscode.Selection(at, at)
      e.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.InCenterIfOutsideViewport)
    }
  }
}

/** View id of a side panel (see package.json). */
export const sidePanelId = (panel: SidePanel): string => `projectScaffold.panel.${panel}`

function documentInit(document: vscode.TextDocument | undefined): Pick<WebviewInit, 'path' | 'uri' | 'text'> {
  if (!document) return { path: '', uri: '', text: '' }
  const { uri } = document
  return {
    path: uri.scheme === 'file' ? uri.fsPath : uri.path,
    uri: uri.toString(),
    text: document.getText()
  }
}

/** Open pages. */
export class Sessions implements vscode.Disposable {
  private readonly all = new Set<DiagramSession>()
  private readonly opened = new vscode.EventEmitter<vscode.TextDocument>()
  /** A document was opened in a diagram. */
  readonly onDidOpen = this.opened.event
  /** Project document of the side panels: of the active diagram, else of the active text editor. */
  private current: vscode.Uri | undefined
  /** Output directories given to the pages: the only ones they write into. */
  private readonly outputs = new Set<string>()
  /** View shown by the diagrams of each document (by name, null: global). */
  private readonly views = new Map<string, string | null>()
  private readonly subscriptions = vscode.Disposable.from(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!e.contentChanges.length) return
      for (const s of this.of(e.document)) s.changed(e.document.getText())
    }),
    vscode.window.onDidChangeActiveTextEditor(() => this.follow())
  )

  constructor(private readonly context: vscode.ExtensionContext) {
    this.follow()
  }

  get media(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.extensionUri, 'media')
  }

  /** Diagram shown in the active editor group, target of the commands. */
  active(): DiagramSession | undefined {
    for (const s of this.all) if (s.active) return s
    return undefined
  }

  /** Pages of a document. */
  of(document: vscode.TextDocument): DiagramSession[] {
    return [...this.all].filter((s) => s.shows(document.uri))
  }

  /** Whether a diagram shows a document. */
  has(document: vscode.TextDocument): boolean {
    return this.of(document).some((s) => s.mode !== 'panel')
  }

  preview(uri: vscode.Uri): DiagramSession | undefined {
    for (const s of this.all) if (s.mode === 'preview' && s.shows(uri)) return s
    return undefined
  }

  viewOf(uri: vscode.Uri): string | null | undefined {
    return this.views.get(uri.toString())
  }

  /** Shows a document (none for a side panel without project) in a webview. */
  async open(
    panel: vscode.WebviewPanel | vscode.WebviewView,
    document: vscode.TextDocument | undefined,
    mode: WebviewMode,
    sidePanel?: SidePanel
  ): Promise<void> {
    const session = new DiagramSession(panel, document?.uri, mode, this)
    this.all.add(session)
    panel.webview.options = { enableScripts: true, localResourceRoots: [this.media] }
    // Text changes one at a time, in order: a save follows the edit before it. The other messages do
    // not wait: an open dialog would hold up the focus, the panels...
    let queue = Promise.resolve()
    const report = (e: unknown): void => void vscode.window.showErrorMessage(`ProjectScaffold: ${String(e)}`)
    const subscription = panel.webview.onDidReceiveMessage((msg: ToHost) => {
      if (ORDERED.has(msg.type)) queue = queue.then(() => session.receive(msg)).catch(report)
      else session.receive(msg).catch(report)
    })
    if ('onDidChangeViewState' in panel) panel.onDidChangeViewState(() => this.fireActive())
    panel.onDidDispose(() => {
      this.all.delete(session)
      subscription.dispose()
      if (!this.active()) void vscode.commands.executeCommand('setContext', FOCUS_CONTEXT, false)
      this.fireActive()
    })
    if (document && mode !== 'panel') this.opened.fire(document)
    this.fireActive()

    const init: WebviewInit = { ...documentInit(document), mode, panel: sidePanel, storage: this.storage() }
    panel.webview.html = await webviewHtml(this.media, panel.webview, init)
  }

  /** Document for a new side panel. */
  currentDocument(): Thenable<vscode.TextDocument> | undefined {
    return this.current && vscode.workspace.openTextDocument(this.current)
  }

  private fireActive(): void {
    void vscode.commands.executeCommand('setContext', ACTIVE_CONTEXT, !!this.active())
    this.follow()
  }

  /** The side panels show the project document being edited; they keep it while none is. */
  private follow(): void {
    const editor = vscode.window.activeTextEditor
    const text =
      editor && (PROJECT_FILE.test(editor.document.uri.path) || this.has(editor.document))
        ? editor.document.uri
        : undefined
    const next = this.active()?.uri ?? text ?? (this.current ? undefined : this.anyProject())
    if (!next || next.toString() === this.current?.toString()) return
    this.current = next
    for (const s of this.all) if (s.mode === 'panel') void s.show(next)
  }

  /** A project document shown somewhere, for side panels that have none yet. */
  private anyProject(): vscode.Uri | undefined {
    const text = vscode.window.visibleTextEditors.find((e) => PROJECT_FILE.test(e.document.uri.path))
    return text?.document.uri ?? [...this.all].find((s) => s.mode !== 'panel' && s.uri)?.uri
  }

  /** A side panel listens for its document: the current one, whatever it was given before. */
  async ready(panel: DiagramSession): Promise<void> {
    this.follow()
    if (this.current) await panel.show(this.current)
  }

  /** A page selected an entity: the other pages of its document show it. */
  reveal(from: DiagramSession, path: DataPath): void {
    for (const s of this.all)
      if (s !== from && s.shows(from.uri)) void s.post({ type: 'reveal', path, names: [] })
  }

  /** A diagram shows another view: its side panels follow. */
  viewChanged(from: DiagramSession, view: string | null): void {
    if (!from.uri) return
    this.views.set(from.uri.toString(), view)
    for (const s of this.all) if (s.mode === 'panel' && s.shows(from.uri)) void s.post({ type: 'view', view })
  }

  /** A side panel asks a diagram of its document for an action: the active one, else any, else a new preview. */
  inDiagram(from: DiagramSession, action: DiagramAction): void {
    const diagrams = [...this.all].filter((s) => s.mode !== 'panel' && s.shows(from.uri))
    const target = diagrams.find((s) => s.active) ?? diagrams[0]
    if (target) void target.post({ type: 'action', action })
    else if (from.uri) void vscode.commands.executeCommand('projectScaffold.showPreview', from.uri)
  }

  /** Output directory of the code generated from a document (see ToHost `outputDir`). */
  async outputDir(document: vscode.Uri, pick: boolean, name: string): Promise<OutputDirReply | null> {
    const key = `outputDir:${document.toString()}`
    const saved = this.context.workspaceState.get<string>(key)
    const setting = vscode.workspace
      .getConfiguration('projectScaffold')
      .get<string>('generate.outputDir', 'generated/${project}')
    const configured = sibling(document, setting.replaceAll('${project}', name))
    let dir = saved ? vscode.Uri.parse(saved) : configured
    if (pick) {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        defaultUri: dir,
        openLabel: 'Generate Here',
        title: 'Generate code into'
      })
      if (!picked?.[0]) return null
      dir = picked[0]
      await this.context.workspaceState.update(key, dir.toString())
    }
    this.outputs.add(dir.toString())
    return { dir: dir.toString(), label: vscode.workspace.asRelativePath(dir) }
  }

  /** Reads, writes or removes a file of an output directory given to a page. */
  async outputFile(
    dir: string,
    path: string,
    op: 'read' | 'write' | 'remove',
    text = ''
  ): Promise<OutputFileReply> {
    const parts = path.split('/')
    if (!this.outputs.has(dir) || parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\')))
      return { error: `'${path}' is not a file of the output directory` }
    const uri = vscode.Uri.joinPath(vscode.Uri.parse(dir), ...parts)
    try {
      switch (op) {
        case 'read':
          return { text: new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)) }
        case 'write':
          await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'))
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text))
          return { text: null }
        case 'remove':
          await vscode.workspace.fs.delete(uri, { useTrash: false })
          return { text: null }
      }
    } catch (e) {
      if (e instanceof vscode.FileSystemError && e.code === 'FileNotFound') return { text: null }
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  private storage(): Record<string, string> {
    return this.context.globalState.get<Record<string, string>>(STORAGE_KEY) ?? {}
  }

  /** Keeps a preference and gives it to the other pages. */
  async store(from: DiagramSession, key: string, value: string | null): Promise<void> {
    const values = { ...this.storage() }
    if ((values[key] ?? null) === value) return
    if (value === null) delete values[key]
    else values[key] = value
    await this.context.globalState.update(STORAGE_KEY, values)
    for (const s of this.all) if (s !== from) void s.post({ type: 'storage', key, value })
  }

  dispose(): void {
    this.subscriptions.dispose()
    this.opened.dispose()
  }
}
