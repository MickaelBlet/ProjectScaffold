// ProjectScaffold for VS Code. Project files (*.scaffold.{yaml,yml,json}) open as text with an
// editable diagram preview beside them; the text cursor and the diagram selection follow each other.
// The app's Explorer and Code generation are tabs of the ProjectScaffold side bar view, opened with the
// first project file, unless the previews dock every tool in their page (full layout). Problems go to
// the Problems panel, the outline of the text to the Outline view.
import * as vscode from 'vscode'
import { structureAt } from '../../src/renderer/src/components/completion'
import { symbolProvider } from './outline'
import { Previews } from './preview'
import { Problems } from './problems'
import { SidePanelProvider } from './sidebar'
import {
  PREVIEW_TYPE,
  PROJECT_FILE,
  Sessions,
  setPreviewLayout,
  SIDE_VIEW,
  syncSelection
} from './session'

/** VS Code commands running an app command in the active diagram. */
const APP_COMMANDS: Record<string, string> = {
  'projectScaffold.addModule': 'insert.module',
  'projectScaffold.arrange': 'arrange.auto',
  'projectScaffold.exportPng': 'file.exportPng',
  'projectScaffold.exportSvg': 'file.exportSvg',
  'projectScaffold.importSettings': 'file.importSettings',
  'projectScaffold.exportSettings': 'file.exportSettings',
  'projectScaffold.generationPanel': 'window.generation',
  'projectScaffold.search': 'window.search',
  'projectScaffold.problems': 'window.problems',
  'projectScaffold.output': 'window.output'
}

/** VS Code commands running an app command for a project document (menus give its URI), in a diagram
 *  opened for it when none is (see Sessions.runFor). */
const DOCUMENT_COMMANDS: Record<string, string> = {
  'projectScaffold.generate': 'file.generate',
  'projectScaffold.generateInto': 'file.generateInto',
  'projectScaffold.codeTemplates': 'file.codeTemplates'
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
    vscode.window.registerWebviewPanelSerializer(PREVIEW_TYPE, previews),
    // The view of the ProjectScaffold container, its tools in tabs.
    vscode.window.registerWebviewViewProvider(SIDE_VIEW, new SidePanelProvider(sessions), {
      webviewOptions: { retainContextWhenHidden: true }
    }),
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
    // From the text editor title (uri given), the files' explorer (uri given, the file maybe not open:
    // its text opens first) or the palette (active text editor).
    vscode.commands.registerCommand('projectScaffold.showPreview', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri
      if (!target) return
      if (!vscode.window.visibleTextEditors.some((e) => e.document.uri.toString() === target.toString()))
        await vscode.window.showTextDocument(target)
      await previews.show(target)
    }),
    vscode.commands.registerCommand('projectScaffold.showSource', async () => {
      const session = sessions.active()
      if (!session) return
      const document = await session.document()
      const shown = vscode.window.visibleTextEditors.find((e) => e.document === document)
      await vscode.window.showTextDocument(document, shown?.viewColumn ?? vscode.ViewColumn.Beside)
    }),
    // Editor title buttons of the diagrams.
    vscode.commands.registerCommand('projectScaffold.layoutFull', () => setPreviewLayout('full')),
    vscode.commands.registerCommand('projectScaffold.layoutIntegrated', () => setPreviewLayout('integrated')),
    // Shortcuts of the diagram that VS Code must not run as well (see package.json).
    vscode.commands.registerCommand('projectScaffold.noop', () => {})
  )
}

export function deactivate(): void {}
