export interface CustomCommandStep {
  command: string;
  args: unknown[];
}

export interface CustomCommand {
  id: string;
  name: string;
  steps: CustomCommandStep[];
}

export type CustomCommandWebviewMessage =
  | { type: 'save'; command: CustomCommand }
  | { type: 'delete'; id: string }
  | { type: 'run'; id: string }
  | { type: 'listAvailableCommands' }
  | { type: 'shortcuts'; id: string };

export type CustomCommandHostMessage =
  | { type: 'updated'; commands: CustomCommand[] }
  | { type: 'error'; message: string }
  | { type: 'availableCommands'; commands: string[] }
  | { type: 'add' };
