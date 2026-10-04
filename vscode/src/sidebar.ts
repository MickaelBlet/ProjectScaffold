// The ProjectScaffold side bar view: a page showing the app's side tools (Explorer, Code generation,
// Settings) in tabs, for the active project document (see Sessions.follow).
import type * as vscode from 'vscode'
import type { Sessions } from './session'

export class SidePanelProvider implements vscode.WebviewViewProvider {
  constructor(private readonly sessions: Sessions) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    await this.sessions.open(view, await this.sessions.currentDocument(), 'panel')
  }
}
