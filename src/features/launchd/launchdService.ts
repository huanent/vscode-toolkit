import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type LaunchAgentState = 'running' | 'loaded' | 'unloaded' | 'error';

export interface LaunchAgentConfig {
	fileName?: string;
	label: string;
	program: string;
	programArguments: string[];
	workingDirectory: string;
	environmentVariables: Record<string, string>;
	keepAlive: boolean;
	runAtLoad: boolean;
	throttleInterval: number;
	standardOutPath: string;
	standardErrorPath: string;
	extra: Record<string, unknown>;
}

export interface LaunchAgent extends LaunchAgentConfig {
	fileName: string;
	state: LaunchAgentState;
	pid?: number;
	lastExitCode?: number;
	error?: string;
}

export interface LaunchAgentDetails {
	label: string;
	state: LaunchAgentState;
	pid?: number;
	lastExitCode?: number;
	runs?: number;
	activeCount?: number;
	program?: string;
	workingDirectory?: string;
	standardOutPath?: string;
	standardErrorPath?: string;
	reason?: string;
	raw: string;
}

type Plist = Record<string, unknown>;

export class LaunchdService {
	private readonly agentsDirectory = join(homedir(), 'Library', 'LaunchAgents');
	private readonly domain = `gui/${process.getuid?.() ?? 0}`;

	async list(): Promise<LaunchAgent[]> {
		await mkdir(this.agentsDirectory, { recursive: true });
		const entries = await readdir(this.agentsDirectory, { withFileTypes: true });
		const agents = await Promise.all(
			entries
				.filter(entry => entry.isFile() && entry.name.endsWith('.plist'))
				.map(entry => this.readAgent(entry.name)),
		);
		return agents.sort((left, right) => left.label.localeCompare(right.label));
	}

	async save(config: LaunchAgentConfig): Promise<void> {
		const normalized = this.normalizeConfig(config);
		await mkdir(this.agentsDirectory, { recursive: true });
		await Promise.all([
			mkdir(dirname(normalized.standardOutPath), { recursive: true }),
			mkdir(dirname(normalized.standardErrorPath), { recursive: true }),
		]);
		const fileName = `${normalized.label}.plist`;
		const targetPath = this.agentPath(fileName);
		const temporaryDirectory = await mkdtemp(join(this.agentsDirectory, '.vscode-toolkit-'));
		const jsonPath = join(temporaryDirectory, 'agent.json');
		const plistPath = join(temporaryDirectory, 'agent.plist');

		try {
			await writeFile(jsonPath, JSON.stringify(this.toPlist(normalized), null, 2), 'utf8');
			await execFileAsync('/usr/bin/plutil', ['-convert', 'xml1', '-o', plistPath, jsonPath]);
			await rename(plistPath, targetPath);
			if (config.fileName && config.fileName !== fileName) {
				await unlink(this.agentPath(config.fileName)).catch(error => {
					if (!isMissingFileError(error)) {
						throw error;
					}
				});
			}
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true });
		}
	}

	async remove(fileName: string, label: string): Promise<void> {
		await this.stop(label).catch(() => undefined);
		await unlink(this.agentPath(fileName));
	}

	async start(fileName: string, label: string): Promise<void> {
		const status = await this.getStatus(label);
		if (status.state === 'unloaded') {
			await this.runLaunchctl(['bootstrap', this.domain, this.agentPath(fileName)]);
			return;
		}
		await this.runLaunchctl(['kickstart', '-k', `${this.domain}/${label}`]);
	}

	async stop(label: string): Promise<void> {
		const status = await this.getStatus(label);
		if (status.state === 'unloaded') {
			return;
		}
		await this.runLaunchctl(['bootout', `${this.domain}/${label}`]);
	}

	async getDetails(label: string): Promise<LaunchAgentDetails> {
		if (!label.trim()) {
			throw new Error('LaunchAgent Label is required.');
		}
		try {
			const { stdout } = await execFileAsync('/bin/launchctl', [
				'print',
				`${this.domain}/${label}`,
			]);
			const state = detailValue(stdout, 'state');
			return {
				label,
				state: state === 'running' ? 'running' : 'loaded',
				pid: detailNumber(stdout, 'pid'),
				lastExitCode: detailNumber(stdout, 'last exit code'),
				runs: detailNumber(stdout, 'runs'),
				activeCount: detailNumber(stdout, 'active count'),
				program: detailValue(stdout, 'program'),
				workingDirectory: detailValue(stdout, 'working directory'),
				standardOutPath: detailValue(stdout, 'stdout path'),
				standardErrorPath: detailValue(stdout, 'stderr path'),
				reason: detailValue(stdout, 'last terminating signal') ?? detailValue(stdout, 'reason'),
				raw: stdout.trim(),
			};
		} catch {
			return {
				label,
				state: 'unloaded',
				raw: `Service ${this.domain}/${label} is not loaded.`,
			};
		}
	}

	private async readAgent(fileName: string): Promise<LaunchAgent> {
		try {
			const { stdout } = await execFileAsync('/usr/bin/plutil', [
				'-convert',
				'json',
				'-o',
				'-',
				this.agentPath(fileName),
			]);
			const plist = JSON.parse(stdout) as Plist;
			const config = this.fromPlist(fileName, plist);
			if (!config.label) {
				throw new Error('The plist does not contain a Label.');
			}
			return { ...config, fileName, ...(await this.getStatus(config.label)) };
		} catch (error) {
			return {
				...emptyConfig(fileName, basename(fileName, '.plist')),
				fileName,
				state: 'error',
				error: errorMessage(error),
			};
		}
	}

	private async getStatus(
		label: string,
	): Promise<Pick<LaunchAgent, 'state' | 'pid' | 'lastExitCode'>> {
		try {
			const { stdout } = await execFileAsync('/bin/launchctl', [
				'print',
				`${this.domain}/${label}`,
			]);
			const state = /^\s*state = (.+)$/m.exec(stdout)?.[1].trim();
			const pidText = /^\s*pid = (\d+)$/m.exec(stdout)?.[1];
			const exitCodeText = /^\s*last exit code = (-?\d+)$/m.exec(stdout)?.[1];
			return {
				state: state === 'running' ? 'running' : 'loaded',
				pid: pidText ? Number(pidText) : undefined,
				lastExitCode: exitCodeText ? Number(exitCodeText) : undefined,
			};
		} catch {
			return { state: 'unloaded' };
		}
	}

	private fromPlist(fileName: string, plist: Plist): LaunchAgentConfig {
		const knownKeys = new Set([
			'Label',
			'Program',
			'ProgramArguments',
			'WorkingDirectory',
			'EnvironmentVariables',
			'KeepAlive',
			'RunAtLoad',
			'ThrottleInterval',
			'StandardOutPath',
			'StandardErrorPath',
		]);
		return {
			fileName,
			label: stringValue(plist.Label),
			program: stringValue(plist.Program),
			programArguments: stringArray(plist.ProgramArguments),
			workingDirectory: stringValue(plist.WorkingDirectory),
			environmentVariables: stringRecord(plist.EnvironmentVariables),
			keepAlive: plist.KeepAlive === true,
			runAtLoad: plist.RunAtLoad === true,
			throttleInterval: numberValue(plist.ThrottleInterval, 10),
			standardOutPath: stringValue(plist.StandardOutPath),
			standardErrorPath: stringValue(plist.StandardErrorPath),
			extra: Object.fromEntries(Object.entries(plist).filter(([key]) => !knownKeys.has(key))),
		};
	}

	private toPlist(config: LaunchAgentConfig): Plist {
		return compact({
			...config.extra,
			Label: config.label,
			Program: config.program || undefined,
			ProgramArguments: config.programArguments.length ? config.programArguments : undefined,
			WorkingDirectory: config.workingDirectory || undefined,
			EnvironmentVariables: Object.keys(config.environmentVariables).length
				? config.environmentVariables
				: undefined,
			KeepAlive: config.keepAlive || undefined,
			RunAtLoad: config.runAtLoad || undefined,
			ThrottleInterval: config.throttleInterval,
			StandardOutPath: config.standardOutPath || undefined,
			StandardErrorPath: config.standardErrorPath || undefined,
		});
	}

	private normalizeConfig(config: LaunchAgentConfig): LaunchAgentConfig {
		const label = config.label.trim();
		if (!/^[A-Za-z0-9._-]+$/.test(label)) {
			throw new Error('Label can only contain letters, numbers, dots, underscores, and hyphens.');
		}
		if (!Number.isInteger(config.throttleInterval) || config.throttleInterval < 0) {
			throw new Error('ThrottleInterval must be a non-negative integer.');
		}
		const defaultLogDirectory = join('/tmp', label);
		return {
			...config,
			label,
			program: config.program.trim() || '/bin/zsh',
			programArguments: config.programArguments.map(value => value.trim()).filter(Boolean),
			workingDirectory: config.workingDirectory.trim(),
			standardOutPath: config.standardOutPath.trim() || join(defaultLogDirectory, 'output.log'),
			standardErrorPath: config.standardErrorPath.trim() || join(defaultLogDirectory, 'error.log'),
		};
	}

	private agentPath(fileName: string): string {
		if (basename(fileName) !== fileName || !fileName.endsWith('.plist')) {
			throw new Error('Invalid LaunchAgent file name.');
		}
		return join(this.agentsDirectory, fileName);
	}

	private async runLaunchctl(args: string[]): Promise<void> {
		try {
			await execFileAsync('/bin/launchctl', args);
		} catch (error) {
			throw new Error(errorMessage(error));
		}
	}
}

function emptyConfig(fileName?: string, label = ''): LaunchAgentConfig {
	return {
		fileName,
		label,
		program: '',
		programArguments: [],
		workingDirectory: '',
		environmentVariables: {},
		keepAlive: false,
		runAtLoad: false,
		throttleInterval: 10,
		standardOutPath: '',
		standardErrorPath: '',
		extra: {},
	};
}

function compact(value: Plist): Plist {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === 'number' ? value : fallback;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function stringRecord(value: unknown): Record<string, string> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string',
		),
	);
}

function errorMessage(error: unknown): string {
	if (
		typeof error === 'object' &&
		error !== null &&
		'stderr' in error &&
		typeof error.stderr === 'string' &&
		error.stderr.trim()
	) {
		return error.stderr.trim();
	}
	return error instanceof Error ? error.message : 'LaunchAgent operation failed.';
}

function isMissingFileError(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function detailValue(output: string, key: string): string | undefined {
	const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^\\s*${escapedKey} = (.+)$`, 'm').exec(output)?.[1].trim();
}

function detailNumber(output: string, key: string): number | undefined {
	const value = detailValue(output, key);
	if (value === undefined || !/^-?\d+$/.test(value)) {
		return undefined;
	}
	return Number(value);
}
