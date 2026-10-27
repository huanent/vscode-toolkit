export function buildLoginShellCommand(command: string, shellOutput: string): string {
  const shell = shellOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^\/(?:[^\r\n\0]*\/)?(?:bash|zsh|fish|ksh|ksh93|mksh|sh|ash|dash)$/.test(line));
  if (!shell) return command;

  const options = '-lc';
  const argument = `'${command.replace(/'/g, "'\\''")}'`;
  return `if [ -t 0 ] && [ -t 1 ]; then '${shell.replace(/'/g, "'\\''")}' -lic ${argument}; else '${shell.replace(/'/g, "'\\''")}' ${options} ${argument}; fi`;
}
