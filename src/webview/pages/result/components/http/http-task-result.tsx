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
        className="p-1 text-sm"
      />
    );
  }

  if (task.status === 'completed') {
    if (isHttpResponseData(task.output)) return <HttpResponseView response={task.output} />;
    return (
      <Empty
        label="HTTP result unavailable"
        title="Could not display this HTTP task"
        description="The saved HTTP response is missing or invalid."
        icon="warning"
      />
    );
  }

  if (!request) {
    return (
      <Empty
        label="HTTP result unavailable"
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
    typeof request.headers === 'object' &&
    request.headers !== null
  );
}

function isHttpResponseData(value: unknown): value is HttpResponseData {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Partial<HttpResponseData>;
  return (
    typeof response.status === 'number' &&
    typeof response.statusText === 'string' &&
    typeof response.body === 'string' &&
    typeof response.request === 'object' &&
    response.request !== null
  );
}
