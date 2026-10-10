export interface Credential {
  id: string;
  name: string;
  type: 'password' | 'privateKey';
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export type CredentialHostMessage =
  | { type: 'credentialsUpdated'; credentials: Credential[] }
  | { type: 'credentialError'; message: string };

export type CredentialWebviewMessage =
  | { type: 'saveCredential'; credential: Credential }
  | { type: 'deleteCredential'; id: string }
  | { type: 'refreshCredentials' };
