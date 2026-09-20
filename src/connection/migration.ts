import { mkdir, readdir, rename, rmdir, stat } from 'node:fs/promises';
import * as path from 'node:path';

const migrations = new Map<string, Promise<void>>();

export function migrateConnections(root: string): Promise<void> {
    const existing = migrations.get(root);
    if (existing) return existing;
    const migration = migrate(root).catch(error => {
        migrations.delete(root);
        throw error;
    });
    migrations.set(root, migration);
    return migration;
}

async function migrate(root: string): Promise<void> {
    const target = path.join(root, 'connection');
    for (const feature of ['ssh', 'database', 'container']) {
        const source = path.join(root, feature);
        let entries;
        try {
            entries = await readdir(source);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
            throw error;
        }
        await mkdir(target, { recursive: true });
        for (const name of entries) {
            const destination = path.join(target, name === 'order.json' ? `${feature}Order.json` : name);
            try {
                await stat(destination);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                await rename(path.join(source, name), destination);
                continue;
            }
            throw new Error(`Connection migration would overwrite ${destination}. The original file was preserved.`);
        }
        await rmdir(source);
    }
}