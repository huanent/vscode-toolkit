export interface SshConnectionConfiguration {
  id: string;
  type: 'ssh';
  parentId?: string;
  name: string;
  host: string;
  port: number;
  user: string;
  privateKeyPath?: string;
}
