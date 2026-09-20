import { createWriteStream } from 'node:fs';
import { link, mkdir, readdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';

const directories = ['credential', 'database', 'ssh', 'container', 'workflow'];

export async function backupStorage(root: string, now = new Date()): Promise<void> {
    const archive = join(root, 'archive');
    await mkdir(archive, { recursive: true, mode: 0o700 });
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    const cutoff = new Date(day);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const filename = `${day.getTime()}.zip`;
    const entries = await readdir(archive, { withFileTypes: true });
    if (!entries.some(entry => entry.name === filename && entry.isFile())) {
        const zip = new ZipFile();
        const temporary = join(archive, `.${randomUUID()}.tmp`);
        const controller = new AbortController();
        zip.on('error', error => controller.abort(error));
        const writing = pipeline(zip.outputStream, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }), { signal: controller.signal });
        void writing.catch(() => { });
        try {
            for (const directory of directories) {
                await addDirectory(zip, root, directory);
            }
            zip.end();
            await writing;
            try {
                await link(temporary, join(archive, filename));
            } catch (error) {
                if (!hasCode(error, 'EEXIST')) throw error;
            }
        } finally {
            controller.abort();
            await writing.catch(() => { });
            await unlink(temporary).catch(error => {
                if (!hasCode(error, 'ENOENT')) throw error;
            });
        }
    }
    for (const entry of entries) {
        if (entry.isFile() && /^\d{13}\.zip$/.test(entry.name) && Number(entry.name.slice(0, -4)) < cutoff.getTime()) {
            await unlink(join(archive, entry.name)).catch(error => {
                if (!hasCode(error, 'ENOENT')) throw error;
            });
        }
    }
}

async function addDirectory(zip: ZipFile, root: string, relative: string): Promise<void> {
    let entries;
    try {
        entries = await readdir(join(root, relative), { withFileTypes: true });
    } catch (error) {
        if (hasCode(error, 'ENOENT')) return;
        throw error;
    }
    zip.addEmptyDirectory(`${relative}/`);
    for (const entry of entries) {
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await addDirectory(zip, root, child);
        else if (entry.isFile()) zip.addFile(join(root, child), child);
    }
}

function hasCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}