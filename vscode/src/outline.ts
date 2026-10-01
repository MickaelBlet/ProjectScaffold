// Outline of project files: symbols for the Outline view and breadcrumbs of their text editors.
import * as vscode from 'vscode'
import { outline, type OutlineKind, type OutlineNode } from '../../src/renderer/src/model/outline'

const SYMBOL_KINDS: Record<OutlineKind, vscode.SymbolKind> = {
  project: vscode.SymbolKind.Package,
  section: vscode.SymbolKind.Namespace,
  struct: vscode.SymbolKind.Struct,
  enum: vscode.SymbolKind.Enum,
  bitmask: vscode.SymbolKind.Enum,
  union: vscode.SymbolKind.Struct,
  exception: vscode.SymbolKind.Event,
  alias: vscode.SymbolKind.TypeParameter,
  primitive: vscode.SymbolKind.TypeParameter,
  field: vscode.SymbolKind.Field,
  value: vscode.SymbolKind.EnumMember,
  interface: vscode.SymbolKind.Interface,
  constant: vscode.SymbolKind.Constant,
  message: vscode.SymbolKind.Method,
  module: vscode.SymbolKind.Module,
  attribute: vscode.SymbolKind.Field,
  method: vscode.SymbolKind.Method,
  port: vscode.SymbolKind.Property,
  dependency: vscode.SymbolKind.Package,
  link: vscode.SymbolKind.Event
}

const textRange = (document: vscode.TextDocument, [start, end]: [number, number]): vscode.Range =>
  new vscode.Range(document.positionAt(start), document.positionAt(end))

function symbol(document: vscode.TextDocument, n: OutlineNode): vscode.DocumentSymbol {
  const s = new vscode.DocumentSymbol(
    n.name || '?',
    n.detail ?? '',
    SYMBOL_KINDS[n.kind],
    textRange(document, n.range),
    textRange(document, n.nameRange)
  )
  s.children = n.children.map((c) => symbol(document, c))
  return s
}

export const symbolProvider: vscode.DocumentSymbolProvider = {
  provideDocumentSymbols: (document) => outline(document.getText()).map((n) => symbol(document, n))
}
