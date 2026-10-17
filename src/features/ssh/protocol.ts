export interface SshConnectionConfiguration {
  id: string;
  type: 'ssh';
  name: string;
  host: string;
  port: number;
  credentialId: string;
  proxyAssetIds?: string[];
}
