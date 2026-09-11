# Toolkit

A developer toolbox for VS Code: AI chat, file browsing, HTTP requests, SSH, databases, containers, and automated workflows.

## Getting Started

Press **Ctrl+Shift+.** (macOS: **Cmd+Shift+.**) or run **Toolkit: Open Dashboard** from the Command Palette. Script runners, package scripts, and Git actions are also available from the VS Code Explorer context menu.

## Features

### Dashboard

- Open Chat, Explorer, and HTTP Client from the quick navigation bar.
- Open Toolkit from the Activity Bar to browse five compact tool tabs and searchable lists in a webview sidebar.
- Connection groups and Launchd status groups are collapsed by default; expand a group to browse its items.
- Create and edit connections, workflows, and LaunchAgents in separate editor tabs. LaunchAgent runtime details also open in an editor tab.
- Existing tool commands and the Dashboard shortcut focus the corresponding sidebar tab.
- Launchd is available on macOS only. Active connections and resource editors still open in separate editor tabs.

### Chat

- Chat with language models available in VS Code and switch between models.
- Open multiple chat tabs, save conversations, and search and manage chat history.
- View Markdown responses and edit messages to send them again.
- Set a custom chat prompt in settings.

Requires an available language model provider in VS Code.

### Explorer

- Browse folders in editor tabs with navigation history and favorites.
- Create, rename, copy, move, and delete files and folders.
- Compress and extract files, and preview ZIP contents.
- Preview spreadsheets and browse and manage SQLite databases.

### HTTP Client

- Create, rename, and delete requests with automatic saving and restoration of the last opened request.
- Work with `.http` and `.rest` files. Separate requests with `###`, define variables with `@name = value`, and reference them with `{{name}}`.
- Get syntax highlighting, request and header completion, hover details, diagnostics, and formatting.
- Automatically format valid JSON bodies, even without a `Content-Type` header.
- Send requests directly from the editor, inspect responses in the Result panel, and cancel requests from the status bar.

Requests require absolute HTTP(S) URLs. Put credentials in headers, not URLs. CONNECT, TRACE, and request bodies on GET or HEAD are not supported.

### SSH

- Connect using passwords or private keys, with support for jump hosts and proxy commands.
- Open remote terminals in editor tabs, save frequently used commands, and view remote metrics.
- Browse, upload, download, and edit remote files over SFTP.

### Database

- Connect to MySQL directly or through an SSH tunnel.
- Browse databases, table definitions, and data, and edit table rows.
- Write and execute SQL with completion, and export query results.
- Import and export databases.

For SQLite files, use **Explorer**.

### Container

- Manage local or SSH-based Docker, Podman, and Apple Container environments.
- Browse and manage container resources in editor tabs.
- Reuse saved SSH connections for remote environments without entering credentials again.

SSH, Database, and Container each support connection search, creation, editing, ordering, duplication, deletion, and import/export.

### Workflow

- Create, search, and save named workflows with descriptions.
- Add, edit, reorder, and delete steps for local shell commands, SSH commands, and single-file SFTP uploads and downloads. Existing SFTP steps default to upload.
- Save and run steps sequentially after confirmation, with logs in the Toolkit Workflow output channel.

Execution requires a trusted workspace. Only one workflow can run at a time, and execution stops on the first error. Cancellation takes effect after the current step finishes; it does not interrupt a running command or transfer. Interactive commands, parallel steps, and directory transfers are not supported. Transfers overwrite destination files. Uploads require the remote parent directory to exist; downloads create local parent directories. Use SSH command steps for other remote file operations.

### Launchd (macOS)

- View user LaunchAgents in `~/Library/LaunchAgents` and check their status.
- Start, stop, create, edit, and delete agents.
- Configure run-at-load behavior, keep-alive behavior, restart intervals, program arguments, environment variables, working directories, and log paths.

### Scripts and Developer Utilities

- **Script runners**: Run JavaScript, TypeScript, single-file C#, shell scripts, and Windows batch files. JavaScript and TypeScript support debugging and untitled editors. Uses Node.js, Bun, .NET, or the appropriate shell.
- **Package scripts**: Discover and run npm or Bun package scripts from the Explorer context menu.
- **Git actions**: Pull, push, fetch, and switch branches from the Explorer context menu.
- **.gitignore generator**: Create or update ignore rules from 185 operating system, language, editor, framework, and tool templates. Preserves custom rules and works fully offline.
- **XML formatting**: Use VS Code's Format Document command with the editor's indentation and line-ending settings.
- **Debug timing**: See execution-time hints when the debugger pauses.

### Copilot Integration

Give Copilot access to authorized connections and saved workflows:

- List SSH, database, and container connections; run remote commands, SQL, container commands, and SFTP file operations.
- Find and read workflows, create or update them, and run them after confirmation.
- Tools are enabled by default. Control AI access per connection.

## Settings and Data

Search for `Toolkit` in VS Code Settings.

| Setting               | Purpose                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `toolkit.storagePath` | Data directory. Supports `~`; leave empty to use extension storage. Reload the extension after changing it. |
| `toolkit.chat.prompt` | Custom prompt for Chat.                                                                                     |

## Development

- `npm test`: Run the Vitest unit tests once.
- `npm run test:watch`: Run the tests in watch mode.
- `npm test -- src/features/xml/xmlFormatter.test.ts`: Run only the XML formatter tests.
- `npm run test:typecheck`: Type-check the tests and Vitest configuration.
- `npm run build`: Type-check and build the extension and webviews.
- `npm run lint`: Check code quality.

XML formatter tests run in Node.js with a mocked VS Code API and the real XML formatter, without launching an extension host.

Keep unit tests next to their implementation as `*.test.ts`. Reserve `tests/` for integration and end-to-end tests.

