import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-stream';
import type { ArchiveIndex } from './service';

type ArchiveMetadata = { fileName: string; uncompressedSize: number };

export async function readTarGzipIndex(
  path: string,
  buildIndex: (entries: AsyncIterable<ArchiveMetadata>) => Promise<ArchiveIndex>,
): Promise<ArchiveIndex> {
  const archive = extract();
  const signal = AbortSignal.timeout(60000);
  const reading = pipeline(createReadStream(path), createGunzip(), archive, { signal });
  async function* entries(): AsyncIterable<ArchiveMetadata> {
    for await (const entry of archive) {
      const header = entry.header;
      yield {
        fileName: header.type === 'directory' ? `${header.name.replace(/\/$/, '')}/` : header.name,
        uncompressedSize: header.size ?? 0,
      };
      for await (const chunk of entry) {
        signal.throwIfAborted();
        void chunk;
      }
    }
  }
  try {
    const [index] = await Promise.all([buildIndex(entries()), reading]);
    return index;
  } finally {
    archive.destroy();
    await reading.catch(() => {});
  }
}

export function parseTarListing(output: string): ArchiveMetadata[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const gnu = /^([\w-])[\w-]{9}\S*\s+\S+\s+(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})? (.+)$/.exec(line);
      const bsd = /^([\w-])[\w-]{9}\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+[A-Za-z]{3}\s+\d{1,2}\s+[\d:]+\s+(.+)$/.exec(line);
      const match = gnu ?? bsd;
      if (!match || !Number.isSafeInteger(Number(match[2])))
        throw new Error('Unsupported remote tar directory output.');
      let name = match[3];
      if (match[1] === 'l') name = name.split(' -> ')[0];
      if (match[1] === 'h') name = name.split(' link to ')[0];
      return { fileName: match[1] === 'd' ? `${name.replace(/\/$/, '')}/` : name, uncompressedSize: Number(match[2]) };
    });
}
