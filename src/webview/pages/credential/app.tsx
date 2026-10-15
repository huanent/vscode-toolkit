import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { useHostData, postToHost } from '@/webview/utils/host-data';
import type { Credential, CredentialHostMessage, CredentialWebviewMessage } from '@/features/credential/protocol';
import { CredentialDialog } from '@/webview/components/credential-dialog';
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

  useEffect(() => {
    const onMessage = (event: MessageEvent<CredentialHostMessage>) => {
      if (event.data?.type !== 'openAddCredential') return;
      setEditingCredential(undefined);
      setDialogOpen(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const credentials = host.status === 'loaded' ? host.data : [];

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

  const columns: DataListColumn<Credential>[] = [
    {
      key: 'type',
      header: 'Type',
      className: 'w-28 shrink-0',
      cell: (row) => row.type,
    },
    {
      key: 'username',
      header: 'Username',
      className: 'w-36 shrink-0 truncate',
      cell: (row) => row.username || '-',
    },
    {
      key: 'description',
      header: 'Description',
      className: 'flex-1 truncate',
      cell: (row) => row.description || '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-20 shrink-0',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button prefix={<Icon name="edit" />} variant="ghost" size="sm" onClick={() => handleEdit(row)}></Button>
          <Button
            prefix={<Icon name="trash" />}
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.id)}
          ></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-screen">
      <div className="flex min-w-0 flex-1 min-h-0 flex-col">
        <DataList
          ariaLabel="Credentials"
          columns={columns}
          entries={credentials}
          entryKey={(row) => row.id}
          onOpen={handleEdit}
          emptyMessage="No credentials."
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
