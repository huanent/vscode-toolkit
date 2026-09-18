import type { CredentialStore } from './store';

export interface ConnectionCredentials {
    username?: string;
    authType?: 'password' | 'privateKey';
    password?: string;
    privateKey?: string;
    passphrase?: string;
    proxyUsername?: string;
    proxyAuthType?: 'password' | 'privateKey';
    proxyPassword?: string;
    proxyPrivateKey?: string;
    proxyPassphrase?: string;
}

export async function resolveCredential(store: CredentialStore, id: unknown, passwordOnly = false) {
    if (typeof id !== 'string' || !id) throw new Error('Select a credential.');
    const credential = await store.get(id);
    if (!credential || credential.type === 'apikey' || (passwordOnly && credential.type !== 'password')) {
        throw new Error('The selected credential is missing or has an unsupported type.');
    }
    return credential;
}

export async function resolveConnectionCredentials(store: CredentialStore, server: {
    type: string;
    credentialId?: string;
    connectionType?: string;
    sshServerId?: string;
    proxy?: { credentialId?: string };
}): Promise<ConnectionCredentials> {
    const result: ConnectionCredentials = {};
    if (server.type !== 'container' || (server.connectionType === 'ssh' && !server.sshServerId)) {
        const credential = await resolveCredential(store, server.credentialId, server.type === 'mysql');
        result.username = credential.user;
        result.authType = credential.type as 'password' | 'privateKey';
        if (credential.type === 'password') result.password = credential.secret;
        else { result.privateKey = credential.secret; result.passphrase = credential.passphrase; }
    }
    if (server.proxy) {
        const credential = await resolveCredential(store, server.proxy.credentialId);
        result.proxyUsername = credential.user;
        result.proxyAuthType = credential.type as 'password' | 'privateKey';
        if (credential.type === 'password') result.proxyPassword = credential.secret;
        else { result.proxyPrivateKey = credential.secret; result.proxyPassphrase = credential.passphrase; }
    }
    return result;
}

export async function resolveFormCredentials(store: CredentialStore, message: Record<string, unknown>, feature: 'ssh' | 'database' | 'container') {
    const resolved = { ...message };
    if (feature !== 'container') {
        const credential = await resolveCredential(store, message.credentialId, feature === 'database');
        resolved.username = credential.user;
        resolved.authType = credential.type;
    }
    if (message.proxyEnabled === true && !(feature === 'container' && message.sshServerId)) {
        const credential = await resolveCredential(store, message.proxyCredentialId);
        resolved.proxyUsername = credential.user;
        resolved.proxyAuthType = credential.type;
    }
    return resolved;
}