import { useEffect, useState } from 'react';
import type { ResultHostMessage, ResultViewState } from '@/features/result/protocol';
import type { WebviewHostMessage } from '@/host/webview-bridge';
import { useHostData } from '@/webview/utils/host-data';

export function useResultState(): {
  state: ResultViewState | undefined;
  loading: boolean;
  error: string | undefined;
} {
  const initial = useHostData<ResultViewState>();
  const [updatedState, setUpdatedState] = useState<ResultViewState>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<ResultHostMessage | WebviewHostMessage<ResultViewState>>) => {
      if (event.data?.type === 'resultStateUpdated') {
        setUpdatedState(event.data.state);
      } else if (event.data?.type === 'loaded') {
        setUpdatedState(event.data.data);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return {
    state: updatedState ?? (initial.status === 'loaded' ? initial.data : undefined),
    loading: !updatedState && initial.status === 'loading',
    error: !updatedState && initial.status === 'error' ? initial.message : undefined,
  };
}
