export function formatTabTitle(name: string, folder?: string): string {
  return folder ? `${name} - ${folder}` : name;
}
