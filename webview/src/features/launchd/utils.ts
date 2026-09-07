import type { LaunchAgent, LaunchAgentConfig, LaunchAgentState } from './types';

export const blankConfig: LaunchAgentConfig = {
	label: '',
	program: '/bin/zsh',
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

export function cloneConfig(config: LaunchAgentConfig): LaunchAgentConfig {
	return {
		...config,
		environmentVariables: { ...config.environmentVariables },
		extra: { ...config.extra },
	};
}

export function stateText(state: LaunchAgentState): string {
	if (state === 'running') return 'Running';
	if (state === 'loaded') return 'Loaded, not running';
	if (state === 'error') return 'Invalid configuration';
	return 'Not loaded';
}

export function statusLabel(agent: LaunchAgent): string {
	if (agent.state === 'running') return agent.pid ? `Running · PID ${agent.pid}` : 'Running';
	if (agent.state === 'loaded')
		return agent.lastExitCode === undefined ? 'Loaded' : `Loaded · Exit ${agent.lastExitCode}`;
	if (agent.state === 'error') return agent.error || 'Invalid plist';
	return 'Not loaded';
}

export function parseEnvironment(value: string): Record<string, string> {
	const entries = value
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
		.map(line => {
			const separator = line.indexOf('=');
			if (separator <= 0) throw new Error(`Environment variable must use KEY=value: ${line}`);
			return [line.slice(0, separator).trim(), line.slice(separator + 1)] as const;
		});
	return Object.fromEntries(entries);
}
