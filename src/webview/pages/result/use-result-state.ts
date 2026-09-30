import { useEffect, useState } from 'react';
import type { ResultHostMessage, ResultViewState } from '@/features/result/protocol';
import { useHostData } from '@/webview/utils/host-data';

export function useResultState(): {
  state: ResultViewState | undefined;
  loading: boolean;
  error: string | undefined;
} {
  const initial = useHostData<ResultViewState>();
  const [updatedState, setUpdatedState] = useState<ResultViewState>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<ResultHostMessage>) => {
      if (event.data?.type === 'resultStateUpdated') {
        setUpdatedState(event.data.state);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return {
    state: updatedState ?? (initial.status === 'loaded' ? initial.data : undefined),
    loading: initial.status === 'loading',
    error: initial.status === 'error' ? initial.message : undefined,
  };
}
