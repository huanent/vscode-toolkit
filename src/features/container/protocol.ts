export type ContainerRuntime = 'apple' | 'docker' | 'podman';

export interface ContainerSettings {
  runtime: ContainerRuntime;
  cliPath?: string;
  sshAssetId?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
}

export interface ContainerEditorData {
  assetId: string;
  assetName: string;
  containers: ContainerInfo[];
}

export type ContainerEditorRequest = { type: 'list' } | { type: 'start' | 'stop' | 'restart' | 'logs'; id: string };

export type ContainerEditorMessage =
  | { type: 'containersUpdated'; containers: ContainerInfo[] }
  | { type: 'logs'; id: string; logs: string }
  | { type: 'containerError'; message: string };
