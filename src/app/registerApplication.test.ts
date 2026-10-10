import { expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';

const registrations = {
    '@/features/dashboard/panel': ['registerDashboard'],
    '@/features/credential/dashboard': ['registerCredential'],
    '@/features/git/sourceControl': ['registerSourceControl'],
    '@/features/git/gitignoreService': ['generateGitignore'],
    '@/features/http/httpClient': ['registerHttpClient'],
    '@/features/chat/registerChat': ['registerChat'],
    '@/features/explorer/registerExplorer': ['registerExplorer'],
    '@/features/perftips/perftips': ['createPerfTipsTracker'],
    '@/features/scripts/packageScripts': ['registerPackageScriptWatcher', 'runPackageScript'],
    '@/features/scripts/runScript': ['runScript'],
    '@/features/scripts/scriptRuntime': ['registerScriptRuntimeWatcher'],
    '@/features/xml/xmlFormatter': ['registerXmlFormatter'],
    '@/features/ssh/registerSsh': ['registerSsh'],
    '@/features/database/registerDatabase': ['registerDatabase'],
    '@/features/container/registerContainer': ['registerContainer'],
    '@/features/workflow/registerWorkflow': ['registerWorkflow'],
    '@/features/excel/editor': ['registerExcelEditor'],
    '@/features/archive/editor': ['registerArchiveEditor'],
    '@/host/registerStorageBackup': ['registerStorageBackup'],
    '@/features/configuration/tools': ['registerConfigurationTools'],
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
vi.doMock('@/features/result/resultView', () => ({
    ResultView: { create: vi.fn().mockResolvedValue({}), viewType: 'result' },
}));

it('registers the dashboard only after all of its feature commands are ready', async () => {
    const { registerApplication } = await import('./registerApplication.js');
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    let finishContainer!: () => void;
    let containerStarted!: () => void;
    const started = new Promise<void>(resolve => { containerStarted = resolve; });
    mocks.get('registerContainer')!.mockImplementation(() => {
        containerStarted();
        return new Promise<void>(resolve => { finishContainer = resolve; });
    });

    const activation = registerApplication(context);
    await started;
    expect(mocks.get('registerDashboard')).not.toHaveBeenCalled();
    for (const name of ['registerSsh', 'registerWorkflow', 'registerDatabase']) {
        expect(mocks.get(name)).toHaveBeenCalledOnce();
    }

    finishContainer();
    await activation;
    expect(mocks.get('registerDashboard')).toHaveBeenCalledExactlyOnceWith(context);
});