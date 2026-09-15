export function formatTerminalCommand(command: string): string {
	if (!/[\r\n]/u.test(command)) {
		return `${command}\r`;
	}
	const script = command.replace(/\r\n?/gu, '\n');
	return `{\n${script}\n}\r`;
}
