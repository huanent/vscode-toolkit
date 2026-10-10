import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Table, type TableColumn } from '@/webview/components/table';
import { useHostData, postToHost } from '@/webview/utils/host-data';
import type { Credential, CredentialHostMessage, CredentialWebviewMessage } from '@/features/credential/protocol';
import { CredentialDialog } from './components/CredentialDialog';
import '@/webview/styles.css';

function App() {
  const host = useHostData<Credential[], CredentialHostMessage>((message, state) => {
    if (message.type === 'credentialsUpdated') {
      return { status: 'loaded', data: message.credentials };
    }
    if (message.type === 'credentialError') {
      // Could show a toast or error message here
      console.error(message.message);
    }
    return state;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | undefined>();

  const credentials = host.status === 'loaded' ? host.data : [];

  const handleAdd = () => {
    setEditingCredential(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (credential: Credential) => {
    setEditingCredential(credential);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    postToHost({ type: 'deleteCredential', id } satisfies CredentialWebviewMessage);
  };

  const handleSave = (credential: Credential) => {
    postToHost({ type: 'saveCredential', credential } satisfies CredentialWebviewMessage);
    setDialogOpen(false);
  };

  const columns: TableColumn<Credential>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => row.name,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => row.type,
    },
    {
      key: 'username',
      header: 'Username',
      cell: (row) => row.username || '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
            <Icon name="edit" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-screen flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Credentials</h1>
        <Button onClick={handleAdd} prefix={<Icon name="add" />}>
          Add Credential
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <Table
          ariaLabel="Credentials"
          columns={columns}
          rows={credentials}
          rowKey={(row) => row.id}
          className="h-full"
        />
      </div>
      <CredentialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        credential={editingCredential}
        onSave={handleSave}
      />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
