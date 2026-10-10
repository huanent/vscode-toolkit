import { spawn } from 'node:child_process';

export function executeLocalCommand(command: string, cwd: string, append: (text: string) => void, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Local command cancelled.', 'AbortError'));
            return;
        }
        const windows = process.platform === 'win32';
        const child = spawn(command, { shell: true, cwd, detached: !windows, stdio: ['ignore', 'pipe', 'pipe'] });
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            if (signal.aborted) reject(new DOMException('Local command cancelled.', 'AbortError'));
            else if (error) reject(error);
            else resolve();
        };
        const terminate = (force: boolean) => {
            try {
                if (windows && child.pid) {
                    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', ...(force ? ['/F'] : [])], { stdio: 'ignore' });
                    killer.on('error', () => { child.kill(force ? 'SIGKILL' : 'SIGTERM'); });
                } else if (child.pid) process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
                else child.kill(force ? 'SIGKILL' : 'SIGTERM');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(force ? 'SIGKILL' : 'SIGTERM');
            }
        };
        const abort = () => {
            timer = setTimeout(() => {
                terminate(true);
                child.stdout.destroy();
                child.stderr.destroy();
                child.unref();
                finish();
            }, 2000);
            terminate(false);
        };
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        child.once('error', finish);
        child.once('close', (code, exitSignal) => finish(code === 0 ? undefined : new Error(`Command exited with ${exitSignal ?? code}.`)));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
    });
}