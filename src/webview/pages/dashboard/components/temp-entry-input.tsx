import { useEffect, useRef, useState } from 'react';
import type { CreateTempEntryRequest, TempContextTarget, TempEntryType, TempFilesWebviewMessage } from '@/features/temp/protocol';
import { Input } from '@/webview/components/ui/input';
import { postToHost } from '@/webview/utils/host-data';

export type TempEntryDraft = { entryType: TempEntryType; target: TempContextTarget; requestId: string };

export function TempEntryInput({ draft, onClose }: { draft: TempEntryDraft; onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: 'nearest' });
    const onMessage = (event: MessageEvent<TempFilesWebviewMessage>) => {
      const message = event.data;
      if (message.type !== 'tempEntryCreated' || message.requestId !== draft.requestId) return;
      if (!message.error) onClose();
      else {
        setError(message.error);
        setPending(false);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [draft.requestId, onClose]);

  return (
    <div className="flex w-full min-w-0 items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Input
        ref={inputRef}
        className="w-full min-w-0"
        aria-label={draft.entryType === 'file' ? 'New file name' : 'New folder name'}
        aria-invalid={Boolean(error)}
        title={error}
        value={name}
        readOnly={pending}
        onChange={(event) => { setName(event.target.value); setError(undefined); }}
        onBlur={() => { if (!pending) onClose(); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending) { event.preventDefault(); onClose(); }
          if (event.key !== 'Enter' || event.nativeEvent.isComposing || pending) return;
          event.preventDefault();
          if (!name.trim() || name.trim() === '.' || name.trim() === '..' || /[/\\\0]/.test(name)) {
            setError('Enter a name without a path.');
            return;
          }
          setPending(true);
          postToHost({ ...draft.target, type: 'createTempEntry', requestId: draft.requestId, entryType: draft.entryType, name } satisfies CreateTempEntryRequest);
        }}
      />
      {error && <div role="alert" title={error} className="min-w-0 truncate text-(--vscode-errorForeground)">{error}</div>}
    </div>
  );
}
