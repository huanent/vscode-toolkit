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

### UI Guidelines

See the [Toolkit UI guide](docs/ui-guide.md) for the VS Code visual baseline,
theme tokens, component conventions, migration priorities, and review checklist.
The guide distinguishes official UX guidance from experimental UI changes and
project-specific recommendations.

### Workflow

Open **Toolkit > Workflow** (or **Toolkit: Open Workflow**) to create and manage
saved workflows in an editor tab. Search workflows in the sidebar and edit step
types, commands, connections and paths inline. Add, reorder or delete named steps;
Save persists changes, while Run saves and executes them sequentially after confirmation.
The toolbar shows running state and opens Toolkit Workflow output. Cancellation is
available in the VS Code progress notification. Unsaved edits prompt before switching workflows.
Steps support non-interactive local shell commands with an absolute working
directory, SSH commands using a saved SSH connection, and single-file SFTP uploads
to an absolute remote file path. Upload parent directories must already exist;
existing remote files are overwritten. Credentials are resolved from SSH at run time.

Workflows are saved in VS Code extension global state on this machine, independently
of `toolkit.storagePath`. Do not embed passwords in commands. Execution requires a
trusted workspace and stops on the first error. Cancel stops after the current step
finishes; it does not interrupt a running command or transfer. Only one workflow
can run at a time. Directory uploads, parallel steps and interactive commands are
not supported.

### Structure

- `src/features`: extension-host features; editors coordinate UI and call feature services.
- `webview/src/features`: React views, hooks, and feature-local components.
- `shared/protocol`: platform-independent message and data types shared by both sides.
- `tests`: offline behavior tests and manifest/build integration checks.

Container command execution is shared by editors and Copilot tools. MySQL overview,
table preview, and table definition logic are separate modules. Keep shared protocols
free of VS Code, Node.js, and React dependencies; validate incoming messages at runtime.

Run `npm run build` followed by `npm test` and `npm run lint` to verify changes.
The integration tests require the generated Webview bundles from the build.

### SSH, Database And Container

Toolkit has three independent entries: SSH, Database and Container. Each opens
its own editor management tab with search, connection creation, editing, ordering,
duplication, deletion and type-specific import/export. Connections open their
terminal, database browser or container manager in editor tabs.

- SSH: password/private-key authentication, jump hosts and proxy commands, terminal,
  saved commands, remote metrics, and SFTP browsing, transfer and file editing.
- MySQL: database and table browsing, data editing, SQL completion and execution,
  result export, and database import/export.
- Containers: local or SSH-based Docker, Podman and Apple Container management.
- Copilot connection lists: `ssh_list_connections`, `database_list_connections`,
  and `container_list_connections`. Execution tools retain their names:
  `servers_ssh`, `servers_sql`, `servers_container` and `servers_sftp`.
- Tool visibility is configured independently with `toolkit.ssh.enableLanguageModelTools`,
  `toolkit.database.enableLanguageModelTools`, and `toolkit.container.enableLanguageModelTools`.
  The previous unified setting is no longer used; set the new switches explicitly
  if tools were previously disabled. Individual connections retain their AI access setting.

Each extension-host feature owns its registration, connection model, store, form,
management panel, custom editor and tools. Form protocols are separate under
`shared/protocol/ssh`, `shared/protocol/database` and `shared/protocol/container`.
There is no shared server feature or form implementation. Container SSH references
use the SSH connection service; database tunnels use the SSH transport.
Previously open `.servers` tabs must be reopened from their feature management tab.

Each feature uses `toolkit.storagePath`, falling back to Toolkit global storage.
Connection files and credentials are stored independently under `ssh/connections`,
`database/connections` and `container/connections`, with a separate `order.json`
in each feature directory. Temporary SQL documents are under `database/mysql-sql`.
Container connections can reference SSH connections without copying their credentials. Storage path expansion
and validation follow Toolkit, including support for `~` and absolute paths.
Reload the extension after changing the storage location.

Existing exports can be imported from the corresponding management tab; other
connection types in the file are ignored. There is no runtime migration or fallback
to the old `servers` directory. To migrate old data, close VS Code and run:

```bash
node scripts/migrate-servers.mjs /absolute/path/to/toolkit-data
```

Run this before opening the new extension for the first time. The script refuses
to overwrite any existing `ssh`, `database` or `container` destination directory.
It copies connection files, credentials, IDs and ordering, preserving SSH references
and leaving the original `servers` directory untouched. Old temporary SQL documents
are not migrated. Connection files
and exports can contain credentials; protect the storage directory and exported files.

Run `npm run build` then `npm run test:features` for connection parsing and feature
isolation regression tests. Live SSH, MySQL and container operations require configured services.

### HTTP Files

Separate requests with `###` lines. Define file-wide variables with `@name = value`
before a request line; reference them with `{{name}}` in URLs, headers, and bodies.
Variables can reference other variables, with diagnostics for missing definitions
and circular references. Definitions inside a request body are treated as body text.

Standalone `#` and `//` comment lines, including indented ones, are excluded from
request bodies. These prefixes inside JSON strings are preserved. A raw text line
starting with either prefix is therefore reserved for comments.

Formatting preserves non-JSON body whitespace and formats valid JSON, including
JSON surrounded by comments. JSON with internal comments is left unchanged by the
formatter. Requests require absolute HTTP(S) URLs; use `Authorization` headers
instead of URL credentials. The fetch transport does not support CONNECT or TRACE,
or request bodies on GET and HEAD. The HTTP version suffix is descriptive and does
not force the negotiated transport version. Responses appear in the Toolkit HTTP
result panel; the status bar provides request cancellation.

Run `npm run test:http` for offline parser, variable, diagnostic, and formatter tests.

### Build

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
