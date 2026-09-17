import type { Connection } from 'mysql2/promise';
import { splitMysqlStatements } from './sqlStatements';

export async function executeSql(
    connect: () => Promise<Connection>,
    sql: string,
    signal: AbortSignal,
): Promise<Awaited<ReturnType<Connection['query']>> | undefined> {
    signal.throwIfAborted();
    const connection = await connect();
    const abort = () => connection.destroy();
    signal.addEventListener('abort', abort, { once: true });
    try {
        if (signal.aborted) connection.destroy();
        signal.throwIfAborted();
        const statements = splitMysqlStatements(sql);
        let result: Awaited<ReturnType<Connection['query']>> | undefined;
        for (const [index, statement] of statements.entries()) {
            signal.throwIfAborted();
            try {
                result = await connection.query(statement);
            } catch (error) {
                signal.throwIfAborted();
                throw new Error(`Statement ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        signal.throwIfAborted();
        return result;
    } finally {
        signal.removeEventListener('abort', abort);
        if (!signal.aborted) await connection.end();
    }
}