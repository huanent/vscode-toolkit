export function buildLoginShellCommand(command: string, shellOutput: string): string {
  const shell = shellOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^\/(?:[^\r\n\0]*\/)?(?:bash|zsh|fish|ksh|ksh93|mksh|sh|ash|dash)$/.test(line));
  if (!shell) return command;

  const name = shell.slice(shell.lastIndexOf('/') + 1);
  const options = ['sh', 'ash', 'dash'].includes(name) ? '-lc' : '-lic';
  const argument = `'${command.replace(/'/g, "'\\''")}'`;
  return `'${shell.replace(/'/g, "'\\''")}' ${options} ${argument}`;
}
