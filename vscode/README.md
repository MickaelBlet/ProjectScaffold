# ProjectScaffold for VS Code

Diagram editor for software architecture inside VS Code: **modules**, **ports**, **typed interfaces** and
**constrained links**, saved as a plain `*.scaffold.yaml` / `*.scaffold.yml` / `*.scaffold.json` file that feeds
code skeleton generators. Built-in **code generation**: C++ (C++98 to C++20), Python and SCA over CORBA, with
executables calling each other across binaries.

![ProjectScaffold in VS Code: side bar, diagram preview and YAML text of the fleet drone example](https://raw.githubusercontent.com/MickaelBlet/ProjectScaffold/HEAD/docs/vscode.png)

- [Features](#features)
- [Getting started](#getting-started)
- [Working with the preview](#working-with-the-preview)
- [Dependencies and IDL files](#dependencies-and-idl-files)
- [Code generation](#code-generation)
- [Commands](#commands)
- [Settings](#settings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Limitations](#limitations)
- [Documentation](#documentation)

## Features

- **Text and diagram side by side**: edit either one, the other follows. Undo, save, hot exit and git diff stay
  VS Code's: the file is a regular text document.
- **Linked selection**: the text cursor and the diagram selection follow each other.
- **Side bar** with the app's Explorer and Code generation, for the file being edited.
- **Two layouts**: _integrated_ (tools in the VS Code side bar) or _full_ (every tool docked in the diagram, like
  the web app).
- **VS Code integration**: Problems panel, Outline and breadcrumbs, an output channel, the color theme.
- **Multi-project architectures**: projects use the types, interfaces and modules of other project files and of
  OMG IDL files.
- **Generate Code** from editable Liquid templates; hand-written code kept across generations.
- **Export** the diagram as PNG / SVG, the app settings as a JSON file to import elsewhere.

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
3. Add modules (Ctrl+M), drag between an `out` port and an `in` port to link them, edit types and interfaces in
   the side bar. Every change lands in the text.
4. **Generate Code** (editor title) writes a C++17 CMake project into `generated/hello` next to the file.

Larger examples, with dependencies, binaries and IDL files:
[`examples/`](https://github.com/MickaelBlet/ProjectScaffold/tree/HEAD/examples).

## Working with the preview

### Opening

| Where                         | How                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Project file (`*.scaffold.*`) | **Open Preview**: Ctrl+K V or the editor title icon                             |
| Any other YAML / JSON file    | **Open Preview** in the explorer's right-click menu                             |
| Diagram → text                | **Show Source** in the diagram's editor title                                   |
| ProjectScaffold side bar      | activity bar icon; shown when a project file is first opened and with a preview |

The preview opens on the left of the text by default (`projectScaffold.preview.position`).

### Editing

- Changes made on either side update the other. Undo in the preview undoes the diagram's changes; undo in the
  text, the text's.
- Selecting an entity in the side bar shows it in the diagram and the text. Opening a view or an editor from the
  side bar opens it in the diagram (a preview when none is open); a dependency shows in the diagram's Inspector.
- App settings (theme, link style, port style, grid, minimap…) are in the **Settings** panel, with the diagram's
  Inspector (Ctrl+,). Theme _VS Code_ (the default) follows the VS Code color theme.

### Layouts

| Layout                   | Tools                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrated (the default) | Explorer and Code generation in the ProjectScaffold side bar, Inspector and Settings in the diagram; templates (built-in ones read-only) and generated files open in VS Code's editors |
| Full                     | Explorer, Code generation, Search, Inspector, Settings, Problems and Output docked in the diagram, like the web app; templates and generated files open in their tabs                  |

Switch with the **Full** / **Integrated** button of the diagram's toolbar, _Window › Full layout_, the editor
title button (**Switch to Full Layout** / **Switch to Integrated Layout**) or the setting
`projectScaffold.preview.layout`. Every open preview follows, keeping its views; back to the integrated layout,
the ProjectScaffold side bar shows. Each layout keeps its own panel arrangement.

### VS Code panels

| VS Code                  | Shows                                                       |
| ------------------------ | ----------------------------------------------------------- |
| Problems                 | validation errors and warnings, on the line of their entity |
| Outline, breadcrumbs     | the project's sections and entities                         |
| Output › ProjectScaffold | code generation file by file, status messages               |

Errors block code generation; warnings do not.

## Dependencies and IDL files

- **Add dependency…** (diagram's _Insert_ menu, or + in the Explorer's _Dependencies_) lists the project files
  and IDL files of the workspace, several at once (**Browse…** for others). Their types and interfaces are used
  read-only, like the project's own; their modules can be placed and linked to.
- Dependencies are refreshed from the files next to the document. Only project and IDL files are read; reading one out of
  the workspace and of the document's folder asks first, once per folder.
- **Import projects or IDL files** copies their content into the project instead.
- IDL files (`#include` read next to the file and in its parent folders) open in VS Code's own editor.

See [Dependencies](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/dependencies.md) and
[IDL files](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/idl.md).

## Code generation

**Generate Code** (text editor title, diagram title, explorer right-click menu, side bar) renders the project's
template set into `generated/<project>` next to the file (`projectScaffold.generate.outputDir`). A preview opens
for it when no diagram shows the file. **Generate Code Into…** picks another directory, remembered for the file.
The project must have no errors.

| Template set                       | Writes                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `cpp17` (default)                  | a C++17 CMake project                                |
| `cpp20`, `cpp14`, `cpp11`, `cpp98` | the same in another C++ standard                     |
| `python`                           | a Python 3.8+ package (standard library only)        |
| `sca-cpp98`                        | SCA 2.2.2 components in C++98 over CORBA (omniORB 4) |

The project picks its set in _Inspector › Project › Code generation_ (`generation.templates` in the file), or with
**Code Templates…**, which also picks a folder of templates of your own (`projectScaffold.generate.templates`).
A template set in `<output directory>/.scaffold/templates/` replaces the built-in one.

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
- `.scaffold-gen.json` in the output directory records what was generated: keep it with the code.

See [Code generation](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/code-generation.md).

## Commands

All under **ProjectScaffold:** in the command palette.

| Command                                                 | Description                                | Also in                                         |
| ------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Open Preview                                            | Diagram beside the text (Ctrl+K V)         | text editor title, explorer menu                |
| Show Source                                             | Text of the diagram's file                 | diagram title                                   |
| Switch to Full Layout / Switch to Integrated Layout     | Layout of the previews                     | diagram title                                   |
| Add Module                                              | New module in the diagram                  |                                                 |
| Auto-arrange                                            | Lay out the diagram (ELK)                  |                                                 |
| Export Diagram as PNG… / as SVG…                        | Image of the diagram                       | diagram title (…)                               |
| Import Settings… / Export Settings…                     | App settings as a JSON file                |                                                 |
| Generate Code                                           | Code into the default directory            | text editor title, diagram title, explorer menu |
| Generate Code Into…                                     | Code into a chosen directory               | diagram title (…)                               |
| Code Templates…                                         | Template set or folder generating the code | diagram title (…)                               |
| Show Code Generation / Search / Problems / Output Panel | Tool panel of the diagram                  |                                                 |

## Settings

| Setting                               | Default                | Description                                                                                              |
| ------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `projectScaffold.syncSelection`       | `true`                 | Text cursor and diagram selection follow each other                                                      |
| `projectScaffold.views.revealOnOpen`  | `true`                 | Opening a project file shows the ProjectScaffold side bar                                                |
| `projectScaffold.preview.layout`      | `integrated`           | Layout of the preview (`integrated` / `full`)                                                            |
| `projectScaffold.preview.position`    | `left`                 | Side of the text where the preview opens (`left` / `right`)                                              |
| `projectScaffold.preview.showSideBar` | `true`                 | Opening a preview shows the ProjectScaffold side bar                                                     |
| `projectScaffold.generate.outputDir`  | `generated/${project}` | Output of _Generate Code_, relative to the file; `${project}` is the project's namespace                 |
| `projectScaffold.generate.templates`  | (empty)                | Template folder, relative to the file; empty: `.scaffold/templates` of the output, else the built-in set |

## Keyboard shortcuts

While a diagram has the focus, its shortcuts win over VS Code's: Ctrl+P (go to), Ctrl+Shift+P / F1 (its own
command palette), Ctrl+M, Ctrl+D, Ctrl+G, Ctrl+L, Ctrl+I, Ctrl+, , Ctrl+Alt+L / H / V, Alt+Enter, F2… `?` lists
them all. See
[Keyboard shortcuts](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/shortcuts.md).

## Limitations

- Workspace files (`*.scaffold-workspace.yaml`) are not opened: open project files one by one.
- IDL files are edited as text in VS Code's editor, not in the diagram.

## Documentation

- [File format](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/file-format.md): the
  language-agnostic YAML / JSON, described by
  [`schema/scaffold.schema.json`](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/schema/scaffold.schema.json).
  The `editor` section holds layout only and is ignored by generators.
- [Editor](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/editor.md): diagram, views, binaries,
  arrange.
- [C++ and Python mapping](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/mapping.md),
  [Links between binaries](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/remote.md),
  [Writing templates](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/templates.md).
- All guides: [`docs/`](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/README.md).

## Build from source

```sh
scripts/build_vscode.sh
code --install-extension dist-vscode/project-scaffold-vscode-<version>.vsix
```

See [Building](https://github.com/MickaelBlet/ProjectScaffold/blob/HEAD/docs/building.md#vs-code-extension).
