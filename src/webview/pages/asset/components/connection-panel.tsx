import type { AssetEditorData, AssetFormValues } from '@/features/assets/protocol';
import type { Credential } from '@/features/credential/protocol';
import { DatabasePanel } from '@/webview/pages/asset/components/database-panel';
import { HttpClientPanel } from '@/webview/pages/asset/components/http-client-panel';
import { SshPanel } from '@/webview/pages/asset/components/ssh-panel';

export type ConnectionPanelProps = {
  values: AssetFormValues;
  capabilities: AssetEditorData['capabilities'];
  credentials: AssetEditorData['credentials'];
  onChange: (values: Partial<AssetFormValues>) => void;
  onCreateCredential: (credential: Credential) => void;
};

export function ConnectionPanel(props: ConnectionPanelProps) {
  if (props.capabilities.httpClient) return <HttpClientPanel {...props} />;
  if (props.capabilities.database) return <DatabasePanel {...props} />;
  return <SshPanel {...props} />;
}
