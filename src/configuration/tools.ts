import * as vscode from 'vscode';
import { isDeepStrictEqual } from 'node:util';
import { ConfigurationService, type ConfigurationType, type WritableConfigurationType } from './service';
import { CredentialStore } from '../credential/store';
import { getStorageUri } from '../storagePath';
import type { ConfigurationPatch } from './patch';
import type { CredentialSummary } from '../credential/protocol';
import { resolveConfigurationIdentity } from '../credential/configurationIdentity';

export const configurations = new ConfigurationService();

export function validateConfigurationFields(configuration: Record<string, unknown>, parsed: unknown): void {
    const normalized = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
    for (const [key, value] of Object.entries(configuration)) {
        if (!isDeepStrictEqual(normalized[key], value))
            throw new Error(`Invalid or unsupported configuration field: ${key}`);
    }
}

export function registerCredentialConfigurations(store: Pick<CredentialStore, 'list'>): vscode.Disposable {
    return new vscode.Disposable(configurations.register('credential', {
        async list() {
            return (await store.list()).map(({ id, name, type, user }) => ({
                type: 'credential', id, location: '', configuration: { id, name, type, user },
            }));
        },
    }));
}

export function registerConfigurationTools(context: vscode.ExtensionContext): vscode.Disposable {
    const result = (value: unknown) => new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(value, undefined, 2)),
    ]);
    return vscode.Disposable.from(
        registerCredentialConfigurations(new CredentialStore(getStorageUri(context, 'credential').fsPath)),
        vscode.lm.registerTool<{ type?: ConfigurationType; regex?: string }>('readConfigurations', {
            async invoke({ input }) {
                const texts = await configurations.readTexts(input.type, input.regex);
                return new vscode.LanguageModelToolResult(texts.length
                    ? texts.map(text => new vscode.LanguageModelTextPart(text))
                    : [new vscode.LanguageModelTextPart('No matching configurations.')]);
            },
        }),
        vscode.lm.registerTool<{ id: string; patches: ConfigurationPatch[] }>('editConfiguration', {
            prepareInvocation({ input }) {
                return {
                    invocationMessage: `Updating configuration ${input.id}`,
                    confirmationMessages: {
                        title: 'Update configuration?',
                        message: JSON.stringify(input, undefined, 2),
                    },
                };
            },
            async invoke({ input }, token) {
                return result(await configurations.edit(input.id, input.patches, () => token.isCancellationRequested));
            },
        }),
    );
}

export function registerConnectionConfigurations<Server extends { id: string; aiEnabled: boolean }>(
    type: Exclude<WritableConfigurationType, 'workflow'>,
    store: { getServers(): Server[]; getLocation(id: string): string; readText(id: string): Promise<string>; saveServer(server: Server, location?: string): Promise<void> },
    parse: (value: unknown, credentials?: readonly CredentialSummary[]) => Server,
): vscode.Disposable {
    const entry = (server: Server) => ({
        type, id: server.id, location: store.getLocation(server.id), configuration: { ...server },
    });
    const parseConfiguration = async (configuration: Record<string, unknown>) => {
        const credentials = (await configurations.read('credential')).map(entry => entry.configuration as unknown as CredentialSummary);
        const resolved = resolveConfigurationIdentity(configuration, credentials);
        const server = parse(configuration, credentials);
        validateConfigurationFields(resolved, server);
        return server;
    };
    return new vscode.Disposable(configurations.register(type, {
        readText: id => store.readText(id),
        async create(configuration, location) {
            const candidate = { ...configuration, aiEnabled: true, type: type === 'database' ? 'mysql' : type };
            const server = await parseConfiguration(candidate);
            if (store.getServers().some(current => current.id === server.id)) throw new Error('Configuration ID already exists.');
            await store.saveServer(server, location);
            return entry(server);
        },
        async list() { return store.getServers().map(server => entry(parse(server))); },
        async update(_current, configuration, location) {
            const server = await parseConfiguration(configuration);
            await store.saveServer(server, location);
            return entry(server);
        },
    }));
}