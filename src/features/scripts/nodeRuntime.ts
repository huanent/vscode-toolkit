import { execFileSync } from 'node:child_process';

function getNodeVersion(): string {
	try {
		return execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
	} catch {
		throw new Error('Node.js SDK is not installed or is not available on PATH.');
	}
}

export function getTypeScriptRuntimeArgs(): string[] {
	if (compareVersions(getNodeVersion(), 'v22.6.0') < 0) {
		throw new Error('Running TypeScript requires Node.js 22.6.0 or newer.');
	}

	const help = execFileSync('node', ['--help'], { encoding: 'utf8' });
	const runtimeArgs: string[] = [];

	if (help.includes('--experimental-strip-types')) {
		runtimeArgs.push('--experimental-strip-types');
	}
	if (help.includes('--experimental-transform-types')) {
		runtimeArgs.push('--experimental-transform-types');
	}
	if (runtimeArgs.length > 0) {
		runtimeArgs.push('--no-warnings');
	}

	return runtimeArgs;
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.replace(/^v/, '').split('.').map(Number);
	const rightParts = right.replace(/^v/, '').split('.').map(Number);

	for (let index = 0; index < 3; index += 1) {
		const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
		if (difference !== 0) {
			return difference;
		}
	}

	return 0;
}
