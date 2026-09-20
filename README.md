# Toolkit

A developer toolbox for VS Code: AI chat, file browsing, HTTP requests, SSH, databases, containers, and automated workflows.

## Getting Started

Press **Ctrl+Shift+.** (macOS: **Cmd+Shift+.**) or run **Toolkit: Open Dashboard** from the Command Palette. Script runners, package scripts, and Git actions are also available from the VS Code Explorer context menu.

## Features

### Dashboard

- Open Chat, Explorer, and HTTP Client from the quick navigation bar.
- Open Toolkit from the Activity Bar to browse four compact tool tabs and searchable lists in a webview sidebar.
- Connection groups are collapsed by default; expand a group to browse its items.
- Create and edit connections and workflows in separate editor tabs.
- Existing tool commands and the Dashboard shortcut focus the corresponding sidebar tab.
- Active connections and resource editors still open in separate editor tabs.

### Chat

- Chat with language models available in VS Code and switch between models.
- Open multiple chat tabs, save conversations, and search and manage chat history.
- View Markdown responses and edit messages to send them again.
- Attach PNG, JPEG, GIF, WebP images and UTF-8 text/code files using the attachment button, drag and drop, or clipboard paste. Preview and remove attachments before sending, including messages without text.
- Attachments are retained in chat history and when editing, retrying, or regenerating messages. Each message supports up to 10 files, at most 5 MB each. PDF, Office documents, and other binary files are not supported.
- Set a custom chat prompt in settings.

Requires an available language model provider in VS Code.
Image input requires support from the selected provider and model. Attachment contents are sent to that provider and stored with the conversation locally.

### Explorer

- Browse folders in editor tabs with navigation history and favorites.
- Create, rename, copy, move, and delete files and folders.
- Compress and extract ZIP files. Open archives through VS Code's editor associations.
- Open spreadsheets in the Excel editor and browse and manage SQLite databases.

### Archive

- Open local `.zip` and `.ZIP` files in the independent read-only Archive editor. 7z and TAR.GZ are not currently supported.
- Read the ZIP central directory on demand, without loading the whole archive or extracting file contents. Memory use scales with the directory entries, not the archive payload.
- No fixed file-size limit; directory enumeration retains a 30-second timeout. Damaged archives may not be readable.
- Remote URIs are currently rejected: archives are never downloaded for preview. Remote preview requires a separate remote directory-reading connection.
- Archive has no Explorer preview dependency; Explorer ZIP compression and extraction remain separate file operations.

### Excel

- Open `.xlsx` and `.csv` files directly in the read-only Excel editor, including uppercase file extensions.
- Switch worksheets and preview cell values with row and column headers.
- File opening uses VS Code's custom editor associations, with no spreadsheet-specific handling in Explorer. Legacy `.xls` files are not supported.
- Use **Reopen Editor With... > Text Editor** to edit CSV source text.

### HTTP Client

- Create, rename, and delete requests with automatic saving and restoration of the last opened request.
- Work with `.http` and `.rest` files. Separate requests with `###`, define variables with `@name = value`, and reference them with `{{name}}`.
- Get syntax highlighting, request and header completion, hover details, diagnostics, and formatting.
- Automatically format valid JSON bodies, even without a `Content-Type` header.
- Send requests directly from the editor, inspect responses in the Result panel, and cancel requests from the status bar.

Requests require absolute HTTP(S) URLs. Put credentials in headers, not URLs. CONNECT, TRACE, and request bodies on GET or HEAD are not supported.

### SSH

SSH, MySQL, manual Container SSH connections, and SSH proxies use shared `credentialId` references. Manage credentials from the key icon in the Toolkit toolbar, or create one in a connection's credential selector. Credentials are stored as plaintext files under `<toolkit.storagePath>/credential/<id>.json` (the extension storage directory is used when the setting is empty), with owner-only file permissions where supported. Connection exports contain references, not secrets; referenced credentials must exist in the destination store.

Toolkit automatically backs up the storage directory's `credential`, `database`, `ssh`, `container`, and `workflow` folders into `archive/<timestamp>.zip` once per local calendar day. The timestamp is the Unix time in milliseconds at the start of that day. Backups are checked at extension startup and every minute while the extension is running; days when VS Code is closed are not backfilled. Backups older than one calendar year are deleted during a successful check. Workspace-local `.vscode/toolkit` data is not included. ZIP files contain plaintext credentials and are not encrypted; owner-only permissions are applied where supported. Keep the storage directory secure. Failures are recorded in the **Toolkit Backup** output channel and retried on the next check.

#### One-Time Credential Migration

Old inline credentials and the retired `secret.json` format are not supported at runtime. Close VS Code before migrating, and include every workspace that uses the same store. Preview first:

```sh
node scripts/migrateCredentials.mjs --store /absolute/store/path --config-root /absolute/workspace/.vscode/toolkit
```

Repeat `--config-root` for additional workspaces. After reviewing the counts, run the same command with `--apply`. The script backs up original configurations and legacy secrets in a restricted `credential-migration-backup-<id>` directory, creates individual credential files, replaces inline secrets with references, and removes the original `secret.json` only after successful writes. Private-key passphrases are preserved. Existing credential references are validated; missing references stop migration before changes. Re-running after success is safe. Backups contain secrets: retain them securely until connections are verified, then remove them manually. The script does not discover unopened workspaces automatically.

### SSH Connections

- Connect using passwords or private keys, with support for jump hosts and proxy commands.
- Open remote terminals in editor tabs, save frequently used commands, and view remote metrics.
- Browse, upload, download, and edit remote files over SFTP.

### Database

- Connect to MySQL directly or through an SSH tunnel.
- Browse databases, table definitions, and data, and edit table rows.
- Write and execute SQL with completion, and export query results.
- Import and export databases.

Open `.db`, `.sqlite`, or `.sqlite3` files directly with the **SQLite** file editor. The Explorer SQLite action opens the same editor. Database changes are written immediately.

### Container

- Manage local or SSH-based Docker, Podman, and Apple Container environments.
- Browse and manage container resources in editor tabs.
- Reuse saved SSH connections for remote environments without entering credentials again.

SSH, Database, and Container each support connection search, creation, editing, ordering, duplication, deletion, and import/export.

### Workflow

- Create, search, and save named workflows with descriptions.
- Add, edit, reorder, and delete steps for local shell commands, SSH commands, and single-file SFTP uploads and downloads. Existing SFTP steps default to upload.
- Save and run steps sequentially after confirmation, with logs in the Toolkit Workflow output channel.

Execution requires a trusted workspace. Only one workflow can run at a time, and execution stops on the first error. Cancellation requests termination of an active SSH command with TERM, then attempts KILL and disconnects after two seconds if it has not exited. Remote process termination depends on server signal support; detached processes may survive. Local commands receive TERM followed by KILL after two seconds, targeting the process group on macOS/Linux or the process tree with taskkill on Windows. SFTP cancellation closes the transfer channel and connection; partially written destination files may remain and are not rolled back. Interactive commands, parallel steps, and directory transfers are not supported. Transfers overwrite destination files. Uploads require the remote parent directory to exist; downloads create local parent directories. Use SSH command steps for other remote file operations.

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
- `npm test -- src/xml/xmlFormatter.test.ts`: Run only the XML formatter tests.
- `npm run test:typecheck`: Type-check the tests and Vitest configuration.
- `npm run build`: Type-check and build the extension and webviews.
- `npm run lint`: Check code quality.

XML formatter tests run in Node.js with a mocked VS Code API and the real XML formatter, without launching an extension host.

Keep unit tests next to their implementation as `*.test.ts`. Reserve `tests/` for integration and end-to-end tests.
