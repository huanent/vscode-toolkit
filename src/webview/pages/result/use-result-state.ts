import type { ResultHostMessage, ResultViewState } from '@/features/result/protocol';
import { useHostData } from '@/webview/utils/host-data';

export function useResultState(): {
  state: ResultViewState | undefined;
  loading: boolean;
  error: string | undefined;
} {
  const result = useHostData<ResultViewState, ResultHostMessage>((message) =>
    message.type === 'resultStateUpdated' ? { status: 'loaded', data: message.state } : undefined,
  );

  return {
    state: result.status === 'loaded' ? result.data : undefined,
    loading: result.status === 'loading',
    error: result.status === 'error' ? result.message : undefined,
  };
}
