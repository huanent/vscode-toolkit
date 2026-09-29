import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResultTask } from '@/features/result/protocol';
import { ResultTaskContent } from './task-content';

describe('result task content', () => {
  it('renders SQLite query rows through the shared result renderer registry', () => {
    const task: ResultTask = {
      id: 'sqlite-query-1',
      kind: 'sqlite',
      title: 'sample.sqlite: SELECT id, name FROM users',
      status: 'completed',
      createdAt: 100,
      updatedAt: 108,
      input: { databaseName: 'sample.sqlite', sql: 'SELECT id, name FROM users;' },
      output: {
        hasResultSet: true,
        columns: ['id', 'name'],
        rows: [
          [1, 'Ada'],
          [2, null],
        ],
        rowCount: 2,
        truncated: false,
        changes: 0,
      },
    };

    const html = renderToStaticMarkup(<ResultTaskContent task={task} />);

    expect(html).toContain('sample.sqlite');
    expect(html).toContain('SELECT id, name FROM users;');
    expect(html).toContain('Ada');
    expect(html).toContain('NULL');
    expect(html).toContain('SQLite query results');
  });
});
