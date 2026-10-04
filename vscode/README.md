# ProjectScaffold for VS Code

Diagram editor for software architecture inside VS Code: **modules**, **ports**, **typed interfaces** and
**constrained links**, saved as a plain `*.scaffold.yaml` / `*.scaffold.yml` / `*.scaffold.json` file that feeds
code skeleton generators. Built-in **code generation**: C++ (C++98 to C++20) and Python, calling each other
across binaries.

![ProjectScaffold diagram of the fleet drone example](https://raw.githubusercontent.com/MickaelBlet/ProjectScaffold/HEAD/docs/demo.png)

## Features

- **Text and diagram side by side**: edit either one, the other follows. Undo, save, hot exit and git diff stay
  VS Code's: the file is a regular text document.
- **Linked selection**: the text cursor and the diagram selection follow each other.
- **Side bar** with the app's Explorer, Code generation and Settings for the file being edited.
- **Two layouts** for the full diagram editor and the preview: _integrated_ (Explorer, Code generation and Settings
  in the VS Code side bar, compact preview) or _full_ (every tool docked in the diagram, like the web app), switched
  by a button.
- **Problems** panel and **Outline** / breadcrumbs for project files, on the line of each entity.
- **Export** the diagram as PNG/SVG; the app settings as a JSON file, to import elsewhere.
- **Generate Code**: C++ (C++98 to C++20) or Python projects, hand-written code kept across generations.
- Colors follow the VS Code color theme.

## Getting started

1. Create a file ending with `.scaffold.yaml`, for example `hello.scaffold.yaml`:

   ```yaml
   schemaVersion: 1
   project:
     name: Hello
   types: []
   interfaces:
     - name: Greeting
       messages:
         - name: greet
           params:
             - name: who
               type: { kind: primitive, name: string }
           returns: { kind: primitive, name: string }
   modules:
     - name: Client
       ports:
         - { name: greeting, role: out, interface: Greeting }
     - name: Server
       ports:
         - { name: greeting, role: in, interface: Greeting }
   links:
     - name: client_to_server
       from: { module: Client, port: greeting }
       to: { module: Server, port: greeting }
       constraints:
         direction: bidirectional
         ack: { required: false }
         performance: { class: normal }
         remote: { enabled: false }
   ```

2. **Open Preview** (Ctrl+K V, or the icon in the editor title): the diagram opens beside the text.
3. Add modules, drag between an `out` port and an `in` port to link them, edit types and interfaces in the side
   bar. Every change lands in the text.
4. **ProjectScaffold: Generate Code** writes the C++ project into `generated/hello` next to the file.

More examples: [`examples/`](https://github.com/MickaelBlet/ProjectScaffold/tree/HEAD/examples).

## Ways to edit

| Mode                  | How to open                                                                                           | Use it for                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Text + preview        | **Open Preview** (Ctrl+K V) on a project file                                                         | Editing text and diagram together        |
| Full diagram editor   | **Reopen Editor With… › ProjectScaffold**, or **Open in Full Diagram Editor** (explorer context menu) | Diagram only, any YAML/JSON project file |
| ProjectScaffold panel | Activity bar icon (opened with the first project file and with the preview)                           | Explorer, Code generation, Settings      |

- Changes made on either side update the other; undo in the preview undoes the diagram's changes.
- Selecting an entity in the side bar shows it in the diagram and the text; opening a view or an editor opens it
  in the diagram (a preview when none is open); a dependency shows in the diagram's Inspector.
- While a diagram has the focus, its shortcuts win over VS Code's (Ctrl+P, Ctrl+Shift+P, Ctrl+E…): its own
  command palette is Ctrl+Shift+P, `?` lists every shortcut.

### Layouts

| Layout                   | Tools                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrated (the default) | Explorer, Code generation and Settings in the ProjectScaffold side bar, Inspector in the full editor, compact preview (no menu bar, tools on demand); templates (built-in ones read-only) and generated files open in VS Code's editors |
| Full                     | Explorer, Code generation, Search, Inspector, Settings, Problems and Output docked in the full editor and the preview, with the menu bar, like the web app; templates and generated files open in their tabs                            |

Switch with the **Full** / **Integrated** button of the diagram's toolbar, _Window › Full layout_, the editor
title button (**Switch to Full Layout** / **Switch to Integrated Layout**) or the setting
`projectScaffold.editor.layout`. Every open diagram follows, keeping its views; back to the integrated layout, the
ProjectScaffold side bar shows; the full editor and the preview
keep their own panel arrangement in each layout. The preview keeps its own undo history in both.

## Code generation

**Generate Code** renders the project's template set (`generation.templates`, default `cpp17`) into
`generated/<project>` next to the file (setting `projectScaffold.generate.outputDir`); **Generate Code Into…**
picks another directory, remembered for the file. **Code Templates…** picks a folder of templates of your own
(setting `projectScaffold.generate.templates`). The project must have no errors.

Code written inside the user sections is kept when generating again:

```cpp
bool Controller::setMode(const ::common::Mode mode)
{
    // <user:method.setMode>
    return mode != ::common::Mode::Fault; // kept across generations
    // </user:method.setMode>
}
```

- Files changed outside their user sections are reported as conflicts, not overwritten.
- Sections with no place left (renamed method, module or port) go to `<file>.orphans`, never lost.
- A template set in `<output directory>/.scaffold/templates/` replaces the built-in one.

## Commands

All under **ProjectScaffold:** in the command palette.

| Command                                                 | Description                                 |
| ------------------------------------------------------- | ------------------------------------------- |
| Open Preview                                            | Diagram beside the text (Ctrl+K V)          |
| Open in Full Diagram Editor                             | Diagram in its own editor                   |
| Show Source                                             | Text of the diagram's file                  |
| Switch to Full Layout / Switch to Integrated Layout     | Layout of the full diagram editors          |
| Add Module                                              | New module in the diagram                   |
| Auto-arrange                                            | Lay out the diagram (ELK)                   |
| Export Diagram as PNG… / as SVG…                        | Image of the diagram                        |
| Import Settings… / Export Settings…                     | App settings as a JSON file                 |
| Generate Code / Generate Code Into…                     | Code into the default or a chosen directory |
| Code Templates…                                         | Template folder generating the file's code  |
| Show Code Generation / Search / Problems / Output Panel | Tool panel of the diagram                   |

## Settings

| Setting                               | Default                | Description                                                 |
| ------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `projectScaffold.syncSelection`       | `true`                 | Text cursor and diagram selection follow each other         |
| `projectScaffold.preview.position`    | `left`                 | Side of the text where the preview opens (`left` / `right`) |
| `projectScaffold.views.revealOnOpen`  | `true`                 | Opening a project file shows the ProjectScaffold side bar   |
| `projectScaffold.preview.showSideBar` | `true`                 | Opening a preview shows the ProjectScaffold side bar        |
| `projectScaffold.generate.outputDir`  | `generated/${project}` | Output of _Generate Code_, relative to the file             |
| `projectScaffold.generate.templates`  | (empty)                | Template folder, relative to the file; empty: built-in set  |
| `projectScaffold.editor.layout`       | `integrated`           | Layout of the full diagram editor (`integrated` / `full`)   |

App settings (theme, link style, port style, grid, minimap, text editor…) are in the **Settings** view (side bar,
or the editor in the full layout); Theme _VS Code_ (the default) follows the color theme.

## File format

Language-agnostic YAML/JSON, described by a JSON Schema:
[`schema/scaffold.schema.json`](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/schema/scaffold.schema.json).
The `editor` section holds layout only and is ignored by generators. Full reference in the
[main README](https://github.com/MickaelBlet/ProjectScaffold#file-format).

Workspace files (`*.scaffold-workspace.yaml`) are not opened by the extension: open project files one by one.

## Build from source

```sh
scripts/build_vscode.sh
code --install-extension dist-vscode/project-scaffold-vscode-<version>.vsix
```
