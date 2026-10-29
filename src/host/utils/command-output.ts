import { StringDecoder } from 'node:string_decoder';
import { TerminalScreen } from '@/host/utils/terminal-screen';

export class CommandOutput {
  private readonly decoder = new StringDecoder('utf8');
  private readonly screen = new TerminalScreen();
  private truncated = false;

  constructor(private readonly limit = 1024 * 1024) {}

  append(data: Buffer): void {
    this.screen.append(this.decoder.write(data));
    if (this.screen.truncate(this.limit)) this.truncated = true;
  }

  toString(): string {
    const text = this.screen.toString();
    return this.truncated ? `${text}\n[Output truncated at ${this.limit} bytes.]` : text;
  }
}
