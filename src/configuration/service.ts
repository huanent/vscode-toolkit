import { randomUUID } from 'node:crypto';
import { applyConfigurationPatches, type ConfigurationPatch } from './patch';

export const configurationTypes = ['workflow', 'ssh', 'database', 'container', 'credential'] as const;
export type ConfigurationType = typeof configurationTypes[number];
export type WritableConfigurationType = Exclude<ConfigurationType, 'credential'>;

export interface ConfigurationEntry {
    type: ConfigurationType;
    id: string;
    location: string;
    configuration: Record<string, unknown>;
}

export interface ConfigurationProvider {
    list(): Promise<ConfigurationEntry[]>;
    update?(entry: ConfigurationEntry, configuration: Record<string, unknown>, location: string): Promise<ConfigurationEntry>;
    create?(configuration: Record<string, unknown>, location?: string): Promise<ConfigurationEntry>;
}

export class ConfigurationService {
    private readonly providers = new Map<ConfigurationType, ConfigurationProvider>();
    private mutation: Promise<unknown> = Promise.resolve();

    register(type: ConfigurationType, provider: ConfigurationProvider): () => void {
        if (this.providers.has(type)) throw new Error(`Configuration provider already registered: ${type}`);
        this.providers.set(type, provider);
        return () => { this.providers.delete(type); };
    }

    async read(type?: ConfigurationType, regex?: string): Promise<ConfigurationEntry[]> {
        if (type !== undefined && !configurationTypes.includes(type)) throw new Error('Invalid configuration type.');
        if (regex !== undefined && typeof regex !== 'string') throw new Error('regex must be a string.');
        let search: RegExp | undefined;
        if (regex !== undefined) {
            try {
                search = new RegExp(regex, 'i');
            } catch {
                throw new Error('Invalid regex: expected a JavaScript regular expression pattern without / delimiters.');
            }
        }
        const entries = (await Promise.all([...this.providers]
            .filter(([candidate]) => type === undefined || candidate === type)
            .map(([, provider]) => provider.list()))).flat();
        return entries.filter(entry => !search || search.test(JSON.stringify(entry)));
    }

    create(type: WritableConfigurationType, configuration: Record<string, unknown>, location?: string, isCancelled = () => false): Promise<ConfigurationEntry> {
        const pending = this.mutation.then(async () => {
            if (!['workflow', 'ssh', 'database', 'container'].includes(type)) throw new Error('Invalid writable configuration type. Credentials are read-only.');
            if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw new Error('configuration must be an object.');
            for (const key of ['id', 'type', 'location']) {
                if (Object.hasOwn(configuration, key)) throw new Error(`configuration must not include ${key}.`);
            }
            if (location !== undefined && typeof location !== 'string') throw new Error('location must be a string.');
            const provider = this.providers.get(type);
            if (!provider?.create) throw new Error('Configuration creation is unavailable.');
            if (isCancelled()) throw new Error('Configuration creation cancelled.');
            return provider.create({ ...configuration, id: randomUUID() }, location);
        });
        this.mutation = pending.catch(() => { });
        return pending;
    }

    edit(id: string, patches: ConfigurationPatch[], isCancelled = () => false): Promise<ConfigurationEntry> {
        const pending = this.mutation.then(async () => {
            if (typeof id !== 'string' || !id.trim()) throw new Error('id is required.');
            const matches = (await this.read()).filter(entry => entry.id === id);
            if (!matches.length) throw new Error('Configuration was not found or is not enabled for AI. Call readConfigurations first.');
            if (matches.length > 1) throw new Error('Configuration ID is ambiguous across types.');
            if (isCancelled()) throw new Error('Configuration update cancelled.');
            const entry = matches[0];
            const provider = this.providers.get(entry.type);
            if (entry.type === 'credential' || !provider?.update) throw new Error('Credentials are read-only.');
            const document = { ...entry.configuration, location: entry.location };
            const patched: unknown = JSON.parse(applyConfigurationPatches(JSON.stringify(document, undefined, 2), patches));
            if (!patched || typeof patched !== 'object' || Array.isArray(patched)) throw new Error('Configuration must be a JSON object.');
            const { location, ...configuration } = patched as Record<string, unknown>;
            if (configuration.id !== id || configuration.type !== entry.configuration.type) throw new Error('Cannot change configuration id or type.');
            if (typeof location !== 'string') throw new Error('location must be a string.');
            return provider.update(entry, configuration, location);
        });
        this.mutation = pending.catch(() => { });
        return pending;
    }
}