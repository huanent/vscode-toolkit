import * as engine from './engine';
import type { SqliteProcessRequest } from './process-client';

process.once('message', (request: SqliteProcessRequest) => {
  try {
    const operation = engine[request.operation] as (...parameters: unknown[]) => unknown;
    process.send?.({ result: operation(...request.parameters) }, () => process.disconnect());
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : String(error) }, () => process.disconnect());
  }
});