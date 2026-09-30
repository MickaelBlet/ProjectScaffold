// Tool panels of the app (Explorer, Modules, Links, Dependencies, Settings) in the ProjectScaffold side bar, each
// one a page showing the active project document (see Sessions.follow).
import type * as vscode from 'vscode'
import type { SidePanel } from './protocol'
import type { Sessions } from './session'

export const SIDE_PANELS: SidePanel[] = ['explorer', 'modules', 'links', 'dependencies', 'settings']

export class SidePanelProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly sessions: Sessions,
    private readonly panel: SidePanel
  ) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    await this.sessions.open(view, await this.sessions.currentDocument(), 'panel', this.panel)
  }
}
