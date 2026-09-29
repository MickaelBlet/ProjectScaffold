// Full diagram editor of project files ("Reopen Editor With… → ProjectScaffold"), one per document.
import type * as vscode from 'vscode'
import type { Sessions } from './session'

export class ScaffoldEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly sessions: Sessions) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    return this.sessions.open(panel, document, 'editor')
  }
}
