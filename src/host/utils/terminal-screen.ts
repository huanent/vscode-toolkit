const BELL = '\x07';
const ESCAPE = '\x1b';
const MAX_COLUMN = 2048;

/**
 * Replays captured terminal output into plain text. Presentation-only control
 * sequences are dropped, while cursor movement is applied in place so redrawn
 * progress frames collapse into their final state instead of appending a new
 * frame for every refresh.
 */
export class TerminalScreen {
  private readonly lines: string[] = [''];
  private row = 0;
  private column = 0;
  private pending = '';
  private cached: string | undefined;

  append(chunk: string): void {
    if (!chunk) return;
    this.cached = undefined;
    this.pending += chunk;
    this.render();
  }

  toString(): string {
    this.cached ??= this.lines.map((line) => line.trimEnd()).join('\n');
    return this.cached;
  }

  truncate(limit: number): boolean {
    const bytes = Buffer.from(this.toString());
    if (bytes.length <= limit) return false;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(bytes.subarray(0, limit), { stream: true });
    this.lines.length = 0;
    for (const line of text.split('\n')) this.lines.push(line);
    this.row = Math.min(this.row, this.lines.length - 1);
    this.column = Math.min(this.column, this.lines[this.row]!.length);
    this.cached = undefined;
    return true;
  }

  private render(): void {
    const text = this.pending;
    let index = 0;
    while (index < text.length) {
      const escapeIndex = text.indexOf(ESCAPE, index);
      if (escapeIndex < 0) {
        this.writeText(text.slice(index));
        index = text.length;
        break;
      }
      this.writeText(text.slice(index, escapeIndex));
      const end = this.consumeEscape(text, escapeIndex);
      if (end < 0) {
        index = escapeIndex;
        break;
      }
      index = end;
    }
    this.pending = text.slice(index);
  }

  private consumeEscape(text: string, start: number): number {
    const kind = text[start + 1];
    if (kind === undefined) return -1;
    if (kind === '[') return this.consumeControlSequence(text, start);
    if (kind === ']' || kind === 'P' || kind === 'X' || kind === '^' || kind === '_')
      return this.consumeStringSequence(text, start);
    const code = kind.charCodeAt(0);
    if (code >= 0x20 && code <= 0x2f) {
      let index = start + 1;
      while (index < text.length) {
        const intermediate = text.charCodeAt(index);
        if (intermediate < 0x20 || intermediate > 0x2f) break;
        index++;
      }
      return index < text.length ? index + 1 : -1;
    }
    return start + 2;
  }

  private consumeControlSequence(text: string, start: number): number {
    let index = start + 2;
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) {
        this.applyControlSequence(text.slice(start + 2, index), text[index]!);
        return index + 1;
      }
      if (code < 0x20 || code > 0x3f) return index + 1;
      index++;
    }
    return -1;
  }

  private consumeStringSequence(text: string, start: number): number {
    let index = start + 2;
    while (index < text.length) {
      const char = text[index]!;
      if (char === BELL) return index + 1;
      if (char === ESCAPE) {
        const terminator = text[index + 1];
        if (terminator === undefined) return -1;
        if (terminator === '\\') return index + 2;
        index += 2;
        continue;
      }
      index++;
    }
    return -1;
  }

  private applyControlSequence(parameters: string, final: string): void {
    const values = parameters.split(';').map((value) => Number.parseInt(value, 10) || 0);
    const count = (index: number): number => (values[index] && values[index]! > 0 ? values[index]! : 1);
    switch (final) {
      case 'A':
        this.setRow(this.row - count(0));
        break;
      case 'B':
        this.setRow(this.row + count(0));
        break;
      case 'C':
        this.setColumn(this.column + count(0));
        break;
      case 'D':
        this.setColumn(this.column - count(0));
        break;
      case 'E':
        this.setRow(this.row + count(0));
        this.setColumn(0);
        break;
      case 'F':
        this.setRow(this.row - count(0));
        this.setColumn(0);
        break;
      case 'G':
      case '`':
        this.setColumn(count(0) - 1);
        break;
      case 'H':
      case 'f':
        this.setRow(count(0) - 1);
        this.setColumn(count(1) - 1);
        break;
      case 'K':
        this.eraseLine(values[0] ?? 0);
        break;
      case 'J':
        this.eraseDisplay(values[0] ?? 0);
        break;
      default:
        break;
    }
  }

  private setRow(row: number): void {
    this.row = Math.min(Math.max(row, 0), this.lines.length - 1);
  }

  private setColumn(column: number): void {
    this.column = Math.min(Math.max(column, 0), MAX_COLUMN);
  }

  private writeText(text: string): void {
    for (const char of text) {
      if (char === '\n') {
        this.row++;
        if (this.row >= this.lines.length) this.lines.push('');
        this.column = 0;
        continue;
      }
      if (char === '\r') {
        this.column = 0;
        continue;
      }
      if (char === '\b') {
        this.setColumn(this.column - 1);
        continue;
      }
      const code = char.charCodeAt(0);
      if (char !== '\t' && (code < 0x20 || code === 0x7f)) continue;
      this.put(char);
    }
  }

  private put(char: string): void {
    const line = this.lines[this.row]!;
    const column = Math.min(this.column, MAX_COLUMN);
    const written = column > line.length ? `${line}${' '.repeat(column - line.length)}` : line.slice(0, column);
    this.lines[this.row] = `${written}${char}${line.slice(column + 1)}`;
    this.column = column + 1;
  }

  private eraseLine(mode: number): void {
    const line = this.lines[this.row]!;
    if (mode === 1)
      this.lines[this.row] = `${' '.repeat(Math.min(this.column, line.length))}${line.slice(this.column)}`;
    else if (mode === 2) this.lines[this.row] = '';
    else this.lines[this.row] = line.slice(0, this.column);
  }

  private eraseDisplay(mode: number): void {
    if (mode === 1) {
      for (let row = 0; row < this.row; row++) this.lines[row] = '';
      this.eraseLine(1);
      return;
    }
    if (mode === 2) {
      this.lines.splice(0, this.lines.length, '');
      this.row = 0;
      this.column = 0;
      return;
    }
    this.eraseLine(0);
    this.lines.length = this.row + 1;
  }
}
