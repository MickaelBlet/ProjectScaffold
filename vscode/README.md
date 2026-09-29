# ProjectScaffold for VS Code

Diagram editor for `*.scaffold.yaml`, `*.scaffold.yml` and `*.scaffold.json` files: modules, ports, typed
interfaces and constrained links, exported as YAML/JSON for code skeleton generators.

- Project files open as text. **Open Preview** (editor title, or Ctrl+K V) shows an editable diagram beside it,
  on the left by default (`projectScaffold.preview.position`), and opens the ProjectScaffold side bar
  (`projectScaffold.preview.showSideBar`). Changes made on either side update the other; undo in the preview
  undoes the diagram's changes.
- The text cursor and the diagram selection follow each other (setting `projectScaffold.syncSelection`).
- **ProjectScaffold side bar** (activity bar): the app's Explorer, Modules, Links and Settings for the project
  file being edited. Selecting an entity there shows it in the diagram and the text; opening a view or an editor
  opens it in the diagram (a preview when none is open).
- Full-window diagram: **Reopen Editor With… › ProjectScaffold**, or **Open in Full Diagram Editor** from the
  explorer context menu (any YAML/JSON project file).
- The file stays a text document: dirty state, save, hot exit and git diff are VS Code's.
- Problems of the file in the **Problems** panel, on the line of their entity.
- Outline: the **Outline** view and breadcrumbs of the text editor.
- Colors follow the VS Code color theme (app setting Theme: _VS Code_, the default).
- Export YAML/JSON (for generators, no editor data) and PNG/SVG from the diagram title bar or the command palette.
- While a diagram has the focus, its shortcuts win over VS Code's (Ctrl+P, Ctrl+Shift+P, Ctrl+E...): its own
  command palette is Ctrl+Shift+P.

Build from the repository: `scripts/build_vscode.sh`, then
`code --install-extension dist-vscode/project-scaffold-<version>.vsix`.
