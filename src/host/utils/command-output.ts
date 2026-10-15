import { StringDecoder } from 'node:string_decoder';

export class CommandOutput {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  private truncated = false;

  constructor(private readonly limit = 1024 * 1024) {}

  append(data: Buffer): void {
    const remaining = this.limit - this.size;
    if (data.length > remaining) this.truncated = true;
    if (remaining <= 0) return;
    const chunk = Buffer.from(data.subarray(0, remaining));
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  toString(): string {
    const decoder = new StringDecoder('utf8');
    const text = decoder.write(Buffer.concat(this.chunks, this.size));
    return this.truncated ? `${text}\n[Output truncated at ${this.limit} bytes.]` : text + decoder.end();
  }
}
