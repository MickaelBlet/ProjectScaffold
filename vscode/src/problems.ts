// Problems of project files in the VS Code Problems panel: load errors, else validation problems,
// on the line of the entity they concern. Kept up to date while the document is open.
import * as vscode from 'vscode'
import { locateProblems } from '../../src/renderer/src/model/locate'
import { formatFromPath } from '../../src/renderer/src/model/serialize'

/** Delay after the last change of a document before checking it again. */
const CHECK_MS = 300

export class Problems implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('projectScaffold')
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly subscriptions: vscode.Disposable

  /** `isProject`: whether a document is a project file. */
  constructor(private readonly isProject: (document: vscode.TextDocument) => boolean) {
    this.subscriptions = vscode.Disposable.from(
      vscode.workspace.onDidOpenTextDocument((d) => this.check(d)),
      vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => this.forget(d.uri))
    )
    for (const d of vscode.workspace.textDocuments) this.check(d)
  }

  /** Checks a document now, if it is a project file. */
  check(document: vscode.TextDocument): void {
    if (!this.isProject(document)) return
    const problems = locateProblems(document.getText(), formatFromPath(document.uri.path))
    this.collection.set(
      document.uri,
      problems.map((p) => {
        const line = document.lineAt(Math.min(p.line, document.lineCount) - 1)
        const range = new vscode.Range(
          line.lineNumber,
          line.firstNonWhitespaceCharacterIndex,
          line.lineNumber,
          line.text.length
        )
        const severity =
          p.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
        const diagnostic = new vscode.Diagnostic(range, p.message, severity)
        diagnostic.source = 'ProjectScaffold'
        return diagnostic
      })
    )
  }

  private schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString()
    clearTimeout(this.timers.get(key))
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        this.check(document)
      }, CHECK_MS)
    )
  }

  private forget(uri: vscode.Uri): void {
    clearTimeout(this.timers.get(uri.toString()))
    this.timers.delete(uri.toString())
    this.collection.delete(uri)
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t))
    this.subscriptions.dispose()
    this.collection.dispose()
  }
}
