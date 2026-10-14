export interface Credential {
  id: string;
  description: string;
  type: 'password' | 'privateKey';
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CredentialSummary {
  id: string;
  description: string;
  type: 'password' | 'privateKey';
  username?: string;
}

export type CredentialHostMessage =
  | { type: 'credentialsUpdated'; credentials: Credential[] }
  | { type: 'credentialError'; message: string }
  | { type: 'openAddCredential' };

export type CredentialWebviewMessage =
  | { type: 'saveCredential'; credential: Credential }
  | { type: 'deleteCredential'; id: string }
  | { type: 'refreshCredentials' };
