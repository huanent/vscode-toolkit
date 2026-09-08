import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { formatTerminalCommand } from '../src/features/servers/ssh/terminalCommand.ts';

function executeCommand(command) {
	const result = spawnSync('bash', ['--noprofile', '--norc'], {
		input: formatTerminalCommand(command).replace(/\r$/u, '\n'),
		encoding: 'utf8',
		timeout: 5000,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout;
}

test('single-line commands keep their original terminal input', () => {
	assert.equal(formatTerminalCommand('pwd'), 'pwd\r');
});

test('multiline commands are grouped and line endings are normalized', () => {
	for (const newline of ['\n', '\r\n', '\r']) {
		assert.equal(formatTerminalCommand(`pwd${newline}whoami`), '{\npwd\nwhoami\n}\r');
	}
});

test('a command reading stdin cannot consume subsequent script lines', () => {
	assert.equal(
		executeCommand("read -r swallowed || :\nprintf 'second\\n'\nprintf 'third\\n'"),
		'second\nthird\n',
	);
});

test('heredocs, blank lines, and trailing comments remain valid', () => {
	assert.equal(
		executeCommand("\ncat <<'EOF'\n$literal\nEOF\n\nprintf 'done\\n' # final comment"),
		'$literal\ndone\n',
	);
});

test('command groups preserve changes in the current shell', () => {
	const input = `${formatTerminalCommand('value=retained\n:').replace(/\r$/u, '\n')}printf '%s' "$value"\n`;
	const result = spawnSync('bash', ['--noprofile', '--norc'], {
		input,
		encoding: 'utf8',
		timeout: 5000,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, 'retained');
});
