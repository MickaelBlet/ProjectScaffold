// ProjectScaffold for VS Code. Project files (*.scaffold.{yaml,yml,json}) open in the full diagram
// editor, or as text with an editable diagram preview beside them; the text cursor and the diagram
// selection follow each other. The app's Explorer, Modules, Links and Settings are views in VS Code's
// Explorer (or the ProjectScaffold side bar). Problems go to the Problems panel, the outline of the
// text to the Outline view.
import * as vscode from 'vscode'
import { structureAt } from '../../src/renderer/src/components/completion'
import { ScaffoldEditorProvider } from './editor'
import { symbolProvider } from './outline'
import { Previews } from './preview'
import { Problems } from './problems'
import { SIDE_PANELS, SidePanelProvider } from './sidebar'
import { PREVIEW_TYPE, PROJECT_FILE, Sessions, VIEW_TYPE, sidePanelIds, syncSelection } from './session'

/** VS Code commands running an app command in the active diagram. */
const APP_COMMANDS: Record<string, string> = {
  'projectScaffold.addModule': 'insert.module',
  'projectScaffold.arrange': 'arrange.auto',
  'projectScaffold.exportYaml': 'file.exportYaml',
  'projectScaffold.exportJson': 'file.exportJson',
  'projectScaffold.exportPng': 'file.exportPng',
  'projectScaffold.exportSvg': 'file.exportSvg'
}

/** VS Code commands running an app command for a project document (menus give its URI), in a diagram
 *  opened for it when none is (see Sessions.runFor). */
const DOCUMENT_COMMANDS: Record<string, string> = {
  'projectScaffold.generate': 'file.generate',
  'projectScaffold.generateInto': 'file.generateInto',
  'projectScaffold.codeTemplates': 'file.codeTemplates',
  'projectScaffold.definitions': 'view.definitions'
}

/** Delay after the last cursor move before the diagram shows what is under it. */
const FOLLOW_MS = 250

/** The diagrams of a document show the entity under the text cursor. */
function followCursor(sessions: Sessions): vscode.Disposable {
  let timer: ReturnType<typeof setTimeout> | undefined
  const subscription = vscode.window.onDidChangeTextEditorSelection((e) => {
    // Moves made by the extension (Command) come from the diagram.
    const byUser =
      e.kind === vscode.TextEditorSelectionChangeKind.Keyboard ||
      e.kind === vscode.TextEditorSelectionChangeKind.Mouse
    if (!byUser || !syncSelection() || !sessions.has(e.textEditor.document)) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const document = e.textEditor.document
      const { path, names } = structureAt(
        document.getText(),
        document.offsetAt(e.textEditor.selection.active)
      )
      for (const s of sessions.of(document)) void s.post({ type: 'reveal', path, names })
    }, FOLLOW_MS)
  })
  return new vscode.Disposable(() => {
    clearTimeout(timer)
    subscription.dispose()
  })
}

export function activate(context: vscode.ExtensionContext): void {
  const sessions = new Sessions(context)
  const previews = new Previews(sessions)
  const problems = new Problems((d) => PROJECT_FILE.test(d.uri.path) || sessions.has(d))
  const run = (command: string): void => void sessions.active()?.post({ type: 'run', command })

  context.subscriptions.push(
    sessions,
    problems,
    followCursor(sessions),
    // Other files opened in a diagram (Open in ProjectScaffold) are project files too.
    sessions.onDidOpen((d) => problems.check(d)),
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new ScaffoldEditorProvider(sessions), {
      // The page keeps its view (zoom, selection, panels) while its tab is hidden.
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false
    }),
    vscode.window.registerWebviewPanelSerializer(PREVIEW_TYPE, previews),
    // Each panel in the ProjectScaffold container and in VS Code's Explorer (projectScaffold.views.location).
    ...SIDE_PANELS.flatMap((panel) =>
      sidePanelIds(panel).map((id) =>
        vscode.window.registerWebviewViewProvider(id, new SidePanelProvider(sessions, panel), {
          webviewOptions: { retainContextWhenHidden: true }
        })
      )
    ),
    vscode.languages.registerDocumentSymbolProvider(
      { pattern: '**/*.scaffold.{yaml,yml,json}' },
      symbolProvider
    ),
    ...Object.entries(APP_COMMANDS).map(([id, command]) =>
      vscode.commands.registerCommand(id, () => run(command))
    ),
    ...Object.entries(DOCUMENT_COMMANDS).map(([id, command]) =>
      vscode.commands.registerCommand(id, (uri?: unknown) =>
        sessions.runFor(uri instanceof vscode.Uri ? uri : undefined, command)
      )
    ),
    // From the text editor title (uri given) or the palette (active text editor).
    vscode.commands.registerCommand('projectScaffold.showPreview', (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri
      if (target) void previews.show(target)
    }),
    vscode.commands.registerCommand('projectScaffold.showSource', async () => {
      const session = sessions.active()
      if (!session) return
      const document = await session.document()
      const shown = vscode.window.visibleTextEditors.find((e) => e.document === document)
      await vscode.window.showTextDocument(document, shown?.viewColumn ?? vscode.ViewColumn.Beside)
    }),
    // From the explorer (uri given) or the palette (active file).
    vscode.commands.registerCommand('projectScaffold.openWith', (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri
      if (target) void vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE)
    }),
    // Shortcuts of the diagram that VS Code must not run as well (see package.json).
    vscode.commands.registerCommand('projectScaffold.noop', () => {})
  )
}

export function deactivate(): void {}
