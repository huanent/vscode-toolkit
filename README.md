# Toolkit

Developer utilities for VS Code, with extension-host services and React webviews.

## Development

- `npm ci`: install the locked dependencies.
- `npm run check-types`: check the extension host and webview independently.
- `npm run check-types:host`: check extension-host code with Node types, without DOM globals.
- `npm run check-types:webview`: check browser code without ambient Node types.
- `npm run lint`: check source code and import boundaries.
- `npm run validate`: run type checking and lint without modifying files.
- `npm run compile`: validate and build the extension and webviews in development mode.
- `npm run build:production`: build both targets in production mode.
- `npm run format`: explicitly format the repository.

## Architecture

- `src/extension.ts` is the extension entry point.
- `src/app/` composes feature registrations, commands, and webview handlers. It creates and initializes the Result task service before registering consumers, injects it into HTTP, SQLite, and the Result view, and registers it with `ExtensionContext.subscriptions` for disposal.
- `src/host/` contains VS Code adapters and reusable webview infrastructure, without dependencies on concrete features or application composition.
- `src/features/<feature>/` owns feature-specific services, storage, protocols, and host integration.
- `src/shared/` contains runtime-independent contracts used by both the host and browser.
- `src/webview/` contains browser-only React pages, shared components, and communication utilities.

The generic webview handshake is defined in `src/shared/webview-protocol.ts` and implemented by `src/host/webview-bridge.ts` and `src/webview/utils/host-data.ts`.
Feature-specific contracts stay in their owning feature's `protocol.ts`.
The SQLite schema builder is also browser-safe and can be shared without importing database execution code.

### Import Boundaries

Webviews must not import VS Code, Node built-ins, host adapters, application composition, or feature implementations.
Host code must not import webview implementations.
Host infrastructure must not import features or application composition. Features must not depend on the application layer.
Shared contracts and pure logic must not depend on VS Code, Node, React, or either runtime's adapters.
Use `@/` imports for cross-directory dependencies so ownership remains explicit.
Lint enforces the restricted imports; environment-specific TypeScript checks provide an additional guard against accidental runtime globals.

## Refactoring Roadmap

1. Completed: separate validation from formatting, isolate runtime type environments, and extract the generic webview protocol.
2. Completed: introduce an application composition layer with explicit view-to-handler registration and context-owned registration disposal.
3. Completed: separate Result task execution and persistence from webview message delivery and remove Result and HTTP global singletons. Task selection state remains in the Result service so the existing view-state contract is preserved.
4. Completed: separate SQLite file access and database operations from the service coordinating URI validation and editor requests.
5. Completed: Temp view state and watchers have explicit owners; Scripts refreshes reject stale results and handle disposal and errors. Git, PerfTips, Archive, Spreadsheet, and HTTP resource paths were reviewed without structural changes. The shared webview handshake handles transport failures and only marks one-time delivery complete after acceptance.
6. Completed for Result and Dashboard: consolidate initial payloads and pushed updates into one listener and state source per page. Other feature-specific interactions remain page-owned; runtime acceptance is still required.

Each phase must pass type checking and lint. Changes to build boundaries must also pass both builds.
Runtime behavior that requires VS Code must be verified in the extension host; static checks do not replace that verification.

### Result Lifecycle

The task service publishes state-change notifications without importing VS Code or holding webviews.
The Result view adapter subscribes while resolved and releases its subscription when disposed.
Closing a view does not stop tasks. Disposing the application-owned service removes listeners, rejects new operations, and aborts running operations that honor `AbortSignal`.
SQLite execution remains synchronous and cannot be interrupted mid-query.
Existing `result2` storage and task JSON are unchanged. Unfinished persisted tasks are recovered as interrupted on the next activation.
Storage initialization failures reject activation before task consumers are registered.

### SQLite Responsibilities

- `sqlite-service.ts` validates URIs and operation parameters and coordinates database requests.
- `sqlite-file-access.ts` handles local paths and temporary copies for VS Code filesystem providers. Successful write operations copy back changed bytes; failed operations do not copy back. Temporary directories are removed in either case.
- `sqlite-engine.ts` executes synchronous SQLite operations, closes connections, manages schema transactions, and produces preview and query results without importing VS Code.
- `sqlite-schema.ts` builds browser-safe SQL statements; editors and query submission remain separate host adapters.

This separation preserves the existing preview limits, query result limits, and remote write-back behavior.
It does not introduce remote concurrency control or interruptible SQLite execution.

### Temp Lifecycle

Application composition creates and disposes the Temp view controller. Commands receive its refresh callback instead of importing a module-global view implementation.
Refreshes capture the current webview and check that it is still active after loading the tree, so closing or replacing the view does not receive a stale update.
The filesystem provider owns its native watchers and closes them when disposed. Auto-save timer cleanup remains registered with the extension context.
Temporary file locations, URI scheme, command IDs, and webview messages are unchanged.

### Scripts Context Refresh

Package-script and runtime context watchers each own a refresh controller registered with the extension context.
Each scan captures a generation and checks it before setting menu contexts, preventing older scans from publishing stale results.
Disposal invalidates pending scans and blocks new refreshes; scan failures are caught and logged.
Running a package-script command with an empty script list uses the same managed refresh callback.
Scans are not cancelled or debounced, and command availability checks remain synchronous; this phase does not change runtime selection or terminal execution.

### Webview Delivery

The shared host bridge separates payload loading errors from message transport failures.
Loading errors are sent to the page when possible; unavailable or disposed webviews do not produce unhandled transport rejections.
One-time payload delivery is marked complete only when `postMessage` accepts the message, allowing a subsequent `ready` to retry after delivery failure.
Acceptance does not confirm that the browser rendered the payload. The bridge does not automatically retry or cancel feature loaders when a view closes.

### Frontend State

`useHostData` owns the initial handshake and optional feature-message state transitions through a single listener.
Result and Dashboard use feature-specific hooks to map pushed messages into the same state as the initial payload, rather than maintaining parallel initial and updated datasets.
Loaded data is retained when a later error arrives; successful payloads or updates clear that error.
Dashboard keeps tab selection in its page entry and Temp message transitions in `use-temp-state.ts`.
Messages are applied in arrival order. No revision protocol was added, so this does not guarantee ordering across independently produced host snapshots.
