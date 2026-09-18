export type CredentialType = 'password' | 'privateKey' | 'apikey';

export interface CredentialSummary {
    id: string;
    name: string;
    type: CredentialType;
    user: string;
}