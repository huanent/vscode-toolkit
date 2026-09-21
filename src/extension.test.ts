import { expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';

const registrations = {
    './dashboard/panel': ['registerDashboard'],
    './credential/dashboard': ['registerCredential'],
    './git/sourceControl': ['registerSourceControl'],
    './git/gitignoreService': ['generateGitignore'],
    './http/httpClient': ['registerHttpClient'],
    './chat/registerChat': ['registerChat'],
    './explorer/registerExplorer': ['registerExplorer'],
    './perftips/perftips': ['createPerfTipsTracker'],
    './scripts/packageScripts': ['registerPackageScriptWatcher', 'runPackageScript'],
    './scripts/runScript': ['runScript'],
    './scripts/scriptRuntime': ['registerScriptRuntimeWatcher'],
    './xml/xmlFormatter': ['registerXmlFormatter'],
    './ssh/registerSsh': ['registerSsh'],
    './database/registerDatabase': ['registerDatabase'],
    './container/registerContainer': ['registerContainer'],
    './workflow/registerWorkflow': ['registerWorkflow'],
    './excel/editor': ['registerExcelEditor'],
    './archive/editor': ['registerArchiveEditor'],
    './registerStorageBackup': ['registerStorageBackup'],
    './configuration/tools': ['registerConfigurationTools'],
};
const mocks = new Map<string, ReturnType<typeof vi.fn>>();
for (const [path, names] of Object.entries(registrations)) {
    const exports = Object.fromEntries(names.map(name => {
        const mock = vi.fn();
        mocks.set(name, mock);
        return [name, mock];
    }));
    vi.doMock(path, () => exports);
}
vi.doMock('vscode', () => ({
    window: { registerWebviewViewProvider: vi.fn() },
    commands: { registerCommand: vi.fn() },
    debug: { registerDebugAdapterTrackerFactory: vi.fn() },
}));
vi.doMock('./result/resultView', () => ({
    ResultView: { create: vi.fn().mockResolvedValue({}), viewType: 'result' },
}));

it('registers the dashboard only after all of its feature commands are ready', async () => {
    const { activate } = await import('./extension.js');
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    let finishContainer!: () => void;
    let containerStarted!: () => void;
    const started = new Promise<void>(resolve => { containerStarted = resolve; });
    mocks.get('registerContainer')!.mockImplementation(() => {
        containerStarted();
        return new Promise<void>(resolve => { finishContainer = resolve; });
    });

    const activation = activate(context);
    await started;
    expect(mocks.get('registerDashboard')).not.toHaveBeenCalled();
    for (const name of ['registerSsh', 'registerWorkflow', 'registerDatabase']) {
        expect(mocks.get(name)).toHaveBeenCalledOnce();
    }

    finishContainer();
    await activation;
    expect(mocks.get('registerDashboard')).toHaveBeenCalledExactlyOnceWith(context);
});