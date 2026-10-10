import type { ResultTask } from '@/features/result/protocol';
import type { HttpErrorData, HttpRequestData, HttpResponseData } from '@/features/http/protocol';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { HttpErrorView } from './http-error-view';
import { HttpResponseView } from './http-response-view';

interface HttpTaskResultProps {
  task: ResultTask;
}

export function HttpTaskResult({ task }: HttpTaskResultProps) {
  const request = isHttpRequestData(task.input) ? task.input : undefined;

  if (task.status === 'running') {
    return (
      <Loading
        label={request ? `Sending ${request.method} ${request.url}...` : 'Running HTTP request...'}
        className="p-4 text-sm"
      />
    );
  }

  if (task.status === 'completed') {
    if (isHttpResponseData(task.output)) return <HttpResponseView response={task.output} />;
    return (
      <Empty
        title="Could not display this HTTP task"
        description="The saved HTTP response is missing or invalid."
        icon="warning"
      />
    );
  }

  if (!request) {
    return (
      <Empty
        title="Could not display this HTTP task"
        description={task.error ?? 'The saved request data is invalid.'}
        icon="warning"
      />
    );
  }

  const error: HttpErrorData = {
    message: task.error ?? 'The task did not produce a response.',
    timestamp: task.updatedAt,
    request,
  };
  return <HttpErrorView error={error} status={task.status} />;
}

function isHttpRequestData(value: unknown): value is HttpRequestData {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Partial<HttpRequestData>;
  return (
    typeof request.method === 'string' &&
    typeof request.url === 'string' &&
    isHeaders(request.headers) &&
    (request.body === undefined || typeof request.body === 'string')
  );
}

function isHttpResponseData(value: unknown): value is HttpResponseData {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Partial<HttpResponseData>;
  return (
    typeof response.status === 'number' &&
    typeof response.statusText === 'string' &&
    isHeaders(response.headers) &&
    typeof response.body === 'string' &&
    (response.formattedBody === undefined || typeof response.formattedBody === 'string') &&
    typeof response.sizeBytes === 'number' &&
    Number.isFinite(response.sizeBytes) &&
    response.sizeBytes >= 0 &&
    isHttpRequestData(response.request)
  );
}

function isHeaders(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((header) => typeof header === 'string')
  );
}
