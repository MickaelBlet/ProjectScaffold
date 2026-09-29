// Diagram preview beside the text of a project file (like the Markdown preview), editable: its
// changes are written to the text. One per document, on the left or the right of the text (setting
// projectScaffold.preview.position); opening it shows the ProjectScaffold side bar
// (projectScaffold.preview.showSideBar). Restored after a window reload.
import * as vscode from 'vscode'
import { PREVIEW_TYPE, type Sessions } from './session'

const title = (uri: vscode.Uri): string => `Preview ${uri.path.split('/').pop() ?? ''}`

export class Previews implements vscode.WebviewPanelSerializer {
  constructor(private readonly sessions: Sessions) {}

  /** Opens the preview of a document beside its text (the active editor), or shows the open one. */
  async show(uri: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('projectScaffold.preview')
    const open = this.sessions.preview(uri)
    if (open) (open.panel as vscode.WebviewPanel).reveal(undefined, true)
    else if (config.get('position', 'left') === 'left') {
      // No column is "beside, on the left": a new group left of the text's, then back to the text.
      await vscode.commands.executeCommand('workbench.action.newGroupLeft')
      await this.restore(this.create(uri, vscode.ViewColumn.Active), uri)
      await vscode.commands.executeCommand('workbench.action.focusRightGroup')
    } else await this.restore(this.create(uri, vscode.ViewColumn.Beside), uri)
    if (config.get('showSideBar', true)) {
      await vscode.commands.executeCommand('workbench.view.extension.projectScaffold')
      // Typing goes on in the text.
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup')
    }
  }

  private create(uri: vscode.Uri, viewColumn: vscode.ViewColumn): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
      PREVIEW_TYPE,
      title(uri),
      { viewColumn, preserveFocus: true },
      // The page keeps its view (zoom, selection, panels) while its tab is hidden.
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.sessions.media] }
    )
  }

  /** Window reload: the page saved the document it shows (see vscodeApi.ts). */
  async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const uri = (state as { uri?: unknown } | undefined)?.uri
    if (typeof uri !== 'string') {
      panel.dispose()
      return
    }
    await this.restore(panel, vscode.Uri.parse(uri))
  }

  private async restore(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
    let document: vscode.TextDocument
    try {
      document = await vscode.workspace.openTextDocument(uri)
    } catch {
      // Deleted meanwhile.
      panel.dispose()
      return
    }
    panel.title = title(uri)
    panel.iconPath = vscode.Uri.joinPath(this.sessions.media, 'icon.png')
    await this.sessions.open(panel, document, 'preview')
  }
}
