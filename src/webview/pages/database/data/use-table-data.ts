import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type {
  DatabaseRowMutation,
  DatabaseRowMutationResult,
  DatabaseTable,
  DatabaseTableFilterResult,
  DatabaseTableFilters,
} from '@/features/database/protocol';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';

type TableSnapshot = DatabaseTable & { settledQuery?: string; displayedPage?: number };
const initialQuery = JSON.stringify({ search: '', columns: {}, page: 0, revision: 0 });

export function useTableData() {
  const [search, setSearchValue] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const queryKey = JSON.stringify({ search, columns: columnFilters, page, revision });
  const request = useRef({ id: 0, key: initialQuery, page: 0 });
  const mutationRequest = useRef(0);
  const mutationLock = useRef(false);
  const currentQuery = useRef(queryKey);
  currentQuery.current = queryKey;
  const state = useHostData<TableSnapshot, DatabaseTableFilterResult>((message, previous) => {
    if (
      message.type !== 'tableFilterResult' ||
      message.requestId !== request.current.id ||
      request.current.key !== currentQuery.current
    )
      return previous;
    if (message.error)
      return previous.status === 'loaded'
        ? { ...previous, error: message.error, data: { ...previous.data, settledQuery: request.current.key } }
        : previous;
    return message.data
      ? {
          status: 'loaded',
          data: { ...message.data, settledQuery: request.current.key, displayedPage: request.current.page },
        }
      : previous;
  });
  const [editor, setEditor] = useState<{ original?: Record<string, string | number | null> }>();
  const name = state.status === 'loaded' ? state.data.name : (getRootData('name') ?? 'Database Table');
  const pending = state.status === 'loaded' && (state.data.settledQuery ?? initialQuery) !== queryKey;
  const hasActiveFilters = Boolean(search.trim() || Object.values(columnFilters).some((value) => value.trim()));

  useEffect(() => {
    if (state.status !== 'loaded' || (queryKey === initialQuery && request.current.id === 0)) return;
    const requestId = request.current.id + 1;
    request.current = { id: requestId, key: queryKey, page };
    const filters: DatabaseTableFilters = { search, columns: columnFilters, page, revision };
    const timeout = window.setTimeout(() => postToHost({ type: 'filterTable', requestId, filters }), 250);
    return () => window.clearTimeout(timeout);
  }, [queryKey, search, columnFilters, page, revision, state.status]);

  useEffect(() => {
    document.title = name;
  }, [name]);

  const onMutationResult = useEffectEvent((event: MessageEvent<DatabaseRowMutationResult>) => {
    const message = event.data;
    if (
      !message ||
      message.type !== 'rowMutationResult' ||
      message.requestId !== mutationRequest.current ||
      !mutationLock.current
    )
      return;
    mutationLock.current = false;
    setMutationPending(false);
    setMutationError(message.error);
    if (!message.error && !message.cancelled) {
      setEditor(undefined);
      setPage(0);
      setRevision((value) => value + 1);
    }
  });
  useEffect(() => {
    window.addEventListener('message', onMutationResult);
    return () => window.removeEventListener('message', onMutationResult);
  }, []);

  function mutate(mutation: DatabaseRowMutation) {
    if (mutationLock.current || pending) return;
    mutationLock.current = true;
    setMutationPending(true);
    setMutationError(undefined);
    postToHost({ type: 'mutateRow', requestId: ++mutationRequest.current, ...mutation });
  }

  return {
    state,
    name,
    search,
    columnFilters,
    pending,
    hasActiveFilters,
    mutationPending,
    mutationError,
    editor,
    mutate,
    setSearch(value: string) {
      setSearchValue(value);
      setPage(0);
    },
    setColumnFilter(name: string, value: string) {
      setColumnFilters((previous) => {
        const next = { ...previous };
        if (value) next[name] = value;
        else delete next[name];
        return next;
      });
      setPage(0);
    },
    clearFilters() {
      setSearchValue('');
      setColumnFilters({});
      setPage(0);
    },
    refresh() {
      setRevision((value) => value + 1);
    },
    setPage,
    openEditor(original?: Record<string, string | number | null>) {
      setMutationError(undefined);
      setEditor({ original });
    },
    closeEditor() {
      if (!mutationLock.current) setEditor(undefined);
    },
  };
}
