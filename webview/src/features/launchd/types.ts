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

export type LaunchdExtensionMessage =
	| { type: 'launchdAgents'; agents: LaunchAgent[]; message?: string }
	| { type: 'launchdDetails'; details: LaunchAgentDetails }
	| { type: 'launchdError'; message: string };
