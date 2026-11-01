interface CredentialBase {
  id: string;
  description: string;
}

export type Credential = CredentialBase &
  (
    | { type: 'password'; username?: string; password?: string; privateKey?: never; passphrase?: never; apiKey?: never }
    | {
        type: 'privateKey';
        username?: string;
        privateKey?: string;
        passphrase?: string;
        password?: never;
        apiKey?: never;
      }
    | { type: 'apiKey'; username?: never; apiKey?: string; password?: never; privateKey?: never; passphrase?: never }
  );

export interface CredentialSummary {
  id: string;
  description: string;
  type: Credential['type'];
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
