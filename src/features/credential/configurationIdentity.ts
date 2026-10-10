import type { CredentialSummary } from './protocol';

export function resolveConfigurationIdentity(value: unknown, credentials: readonly CredentialSummary[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid server.');
    const configuration = { ...value } as Record<string, unknown>;
    delete configuration.username;
    delete configuration.authType;
    const identity = (id: unknown, passwordOnly = false) => {
        const credential = credentials.find(entry => entry.id === id);
        if (!credential || credential.type === 'apikey' || (passwordOnly && credential.type !== 'password'))
            throw new Error('The selected credential is missing or has an unsupported type.');
    };
    if (configuration.type !== 'container' || (configuration.connectionType === 'ssh' && !configuration.sshServerId)) {
        identity(configuration.credentialId, configuration.type === 'mysql');
    }
    if (configuration.proxy && typeof configuration.proxy === 'object' && !Array.isArray(configuration.proxy)) {
        const proxy = configuration.proxy as Record<string, unknown>;
        identity(proxy.credentialId);
        const reference = { ...proxy };
        delete reference.username;
        delete reference.authType;
        configuration.proxy = reference;
    }
    return configuration;
}