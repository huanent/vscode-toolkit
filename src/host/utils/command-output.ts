import { StringDecoder } from 'node:string_decoder';
import { TerminalScreen } from '@/host/utils/terminal-screen';

export class CommandOutput {
  private readonly decoder = new StringDecoder('utf8');
  private readonly screen = new TerminalScreen();
  private size = 0;
  private truncated = false;

  constructor(private readonly limit = 1024 * 1024) {}

  append(data: Buffer): void {
    const remaining = this.limit - this.size;
    if (data.length > remaining) this.truncated = true;
    if (remaining <= 0) return;
    const chunk = data.subarray(0, remaining);
    this.size += chunk.length;
    this.screen.append(this.decoder.write(chunk));
  }

  toString(): string {
    const text = this.screen.toString();
    return this.truncated ? `${text}\n[Output truncated at ${this.limit} bytes.]` : text;
  }
}
