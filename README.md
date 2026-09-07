# Toolkit

Focused developer tools for VS Code.

## Features

- A dedicated Toolkit item in the Activity Bar.
- Notebook uses a Milkdown WYSIWYG Markdown editor and restores the last opened note.
- Note history, search, creation, switching, renaming, and deletion are available inside the Notebook Webview.
- Notes remain Markdown files in extension storage and save automatically after editing.
- .gitignore Generator creates or updates `.gitignore` files from 185 curated operating system, language, editor, framework, and tool templates while preserving custom rules. Generation works fully offline.
- LaunchAgents on macOS lists user startup items from `~/Library/LaunchAgents`, shows launch status, and supports starting, stopping, creating, editing, and deleting agents.
- LaunchAgent configuration includes `RunAtLoad`, `KeepAlive`, `ThrottleInterval`, program arguments, environment variables, working directory, and output paths.
- Run Script executes and debugs JavaScript and TypeScript files, including untitled editors, runs single-file C# programs with `dotnet run --file`, and runs shell scripts from the Explorer or Toolkit view.
- Run npm Script discovers folders with package scripts and provides an Explorer menu for choosing a script to run.
- HTTP Client is available from the Toolkit Activity Bar and opens the last visited request, or creates one when storage is empty. Requests use editable `toolkit-http:` virtual URIs backed by extension storage, save automatically, and provide new, rename, and delete actions in the editor title. Deleting a request opens the previously visited file. Its language service provides syntax highlighting, precise method replacement, request and header completion, hover details, live request-line and variable diagnostics, formatting, CodeLens actions, and real request execution for `.http` and `.rest` files. Valid JSON request bodies are detected and formatted with the editor's indentation settings even without a `Content-Type` header, and responses are shown in the Toolkit HTTP output channel.
- XML formatting supports VS Code's Format Document command and follows the editor's indentation and line-ending settings.

## Development

```bash
npm install
npm run build
```

Press `F5` in VS Code to build and open an Extension Development Host.

- `npm run lint`: check code with Oxlint; warnings fail the check.
- `npm run lint:fix`: apply automatic Oxlint fixes.
- `npm run format`: format source code, configuration, and documentation with Oxfmt.
- `npm run format:check`: verify formatting without modifying files.

Formatting uses tabs, single quotes, semicolons, and a 100-column print width. JSON, YAML, and Markdown use spaces. Generated output, dependencies, coverage output, bundled gitignore templates, and the lockfile are excluded. Import and package key sorting are disabled to keep formatting changes focused.
