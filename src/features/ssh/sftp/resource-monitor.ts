import { statfs } from 'node:fs/promises';
import { cpus } from 'node:os';
import { win32 } from 'node:path';
import systemInformation from 'systeminformation';
import type { SftpResources } from '@/features/ssh/protocol';
import type { SshService } from '@/features/ssh/ssh-service';

const command = `cat /proc/stat | head -n 1; cat /proc/meminfo | head -n 3; df -Pk / | tail -n 1; cat /proc/net/dev`;

async function readLocalDisk(path: string): Promise<number | undefined> {
  switch (process.platform) {
    case 'darwin':
    case 'linux': {
      const disk = await statfs(path);
      return disk.blocks > 0 ? (1 - disk.bavail / disk.blocks) * 100 : undefined;
    }
    case 'win32': {
      const root = win32.parse(path).root.toLowerCase();
      const disks = await systemInformation.fsSize();
      const disk = disks.find((entry) => win32.parse(entry.mount).root.toLowerCase() === root);
      return disk && disk.size > 0 ? (disk.used / disk.size) * 100 : undefined;
    }
    default:
      return undefined;
  }
}

export class LocalResourceMonitor {
  private previous?: { total: number; idle: number };

  async read(path: string): Promise<SftpResources> {
    const processors = cpus();
    const current = processors.reduce(
      (sum, processor) => ({
        total: sum.total + Object.values(processor.times).reduce((total, value) => total + value, 0),
        idle: sum.idle + processor.times.idle,
      }),
      { total: 0, idle: 0 },
    );
    const previous = this.previous;
    this.previous = current;
    const totalDelta = previous ? current.total - previous.total : 0;
    const [disk, memory, interfaces] = await Promise.all([
      readLocalDisk(path).catch(() => undefined),
      systemInformation.mem().catch(() => undefined),
      systemInformation.networkInterfaces().catch(() => []),
    ]);
    const names = interfaces.filter((entry) => !entry.internal).map((entry) => entry.iface);
    const network = names.length ? await systemInformation.networkStats(names.join(',')).catch(() => []) : [];
    const received = network.map((entry) => entry.rx_sec).filter((value) => Number.isFinite(value) && value >= 0);
    const sent = network.map((entry) => entry.tx_sec).filter((value) => Number.isFinite(value) && value >= 0);
    return {
      cpu:
        previous && totalDelta > 0
          ? Math.max(0, Math.min(100, (1 - (current.idle - previous.idle) / totalDelta) * 100))
          : undefined,
      memory: memory && memory.total > 0 ? (1 - memory.available / memory.total) * 100 : undefined,
      disk,
      networkIn: received.length ? received.reduce((sum, value) => sum + value, 0) : undefined,
      networkOut: sent.length ? sent.reduce((sum, value) => sum + value, 0) : undefined,
    };
  }
}

export class SftpResourceMonitor {
  private previous?: { total: number; idle: number; received: number; sent: number; time: number };
  private running = false;
  private last?: SftpResources;

  constructor(
    private readonly ssh: SshService,
    private readonly assetId: string,
    private readonly signal: AbortSignal,
  ) {}

  async read(): Promise<SftpResources | undefined> {
    if (this.running) return this.last;
    this.running = true;
    try {
      const result = await this.ssh.runCommand(this.assetId, command, this.signal);
      if (result.exitCode !== 0) return undefined;
      const lines = result.stdout.split('\n');
      const cpu = lines[0]?.trim().split(/\s+/).slice(1).map(Number);
      const totalMemory = Number(lines.find((line) => line.startsWith('MemTotal:'))?.match(/\d+/)?.[0]);
      const availableMemory = Number(lines.find((line) => line.startsWith('MemAvailable:'))?.match(/\d+/)?.[0]);
      const disk = Number(lines.find((line) => /^\S+\s+\d+\s+\d+\s+\d+\s+\d+%/.test(line))?.match(/(\d+)%/)?.[1]);
      if (!cpu?.length || cpu.some((value) => !Number.isFinite(value))) return undefined;
      let received = 0;
      let sent = 0;
      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.*)$/);
        if (!match || match[1].trim() === 'lo') continue;
        const values = match[2].trim().split(/\s+/).map(Number);
        if (values.length < 16 || values.some((value) => !Number.isFinite(value))) continue;
        received += values[0];
        sent += values[8];
      }
      const current = {
        total: cpu.slice(0, 8).reduce((sum, value) => sum + value, 0),
        idle: (cpu[3] ?? 0) + (cpu[4] ?? 0),
        received,
        sent,
        time: Date.now(),
      };
      const previous = this.previous;
      this.previous = current;
      const elapsed = previous ? (current.time - previous.time) / 1000 : 0;
      const totalDelta = previous ? current.total - previous.total : 0;
      this.last = {
        cpu:
          previous && totalDelta > 0
            ? Math.max(0, Math.min(100, (1 - (current.idle - previous.idle) / totalDelta) * 100))
            : undefined,
        memory:
          totalMemory > 0 && Number.isFinite(availableMemory) ? (1 - availableMemory / totalMemory) * 100 : undefined,
        disk: Number.isFinite(disk) ? disk : undefined,
        networkIn: previous && elapsed > 0 ? Math.max(0, (received - previous.received) / elapsed) : undefined,
        networkOut: previous && elapsed > 0 ? Math.max(0, (sent - previous.sent) / elapsed) : undefined,
      };
      return this.last;
    } catch {
      this.previous = undefined;
      this.last = undefined;
      return undefined;
    } finally {
      this.running = false;
    }
  }
}
