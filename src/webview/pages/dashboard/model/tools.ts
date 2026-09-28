export type Tool = {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: string;
};

export const tools: Tool[] = [
  {
    id: 'command-palette',
    name: 'Command palette',
    description: 'Find and run workspace actions',
    icon: '⌘',
    status: 'Ready',
  },
  {
    id: 'project-notes',
    name: 'Project notes',
    description: 'Keep the next decision close at hand',
    icon: '✦',
    status: '3 notes',
  },
  {
    id: 'quick-links',
    name: 'Quick links',
    description: 'Open your most-used resources',
    icon: '↗',
    status: '6 links',
  },
];
