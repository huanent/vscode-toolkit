export type KeyboardShortcut = 'save' | 'refresh';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

export function getShortcutLabel(shortcut: KeyboardShortcut): string {
  return shortcut === 'save' ? (isMac ? '⌘S' : 'Ctrl+S') : `F5 / ${isMac ? '⌘R' : 'Ctrl+R'}`;
}

export function getAriaShortcut(shortcut: KeyboardShortcut): string {
  const modifier = isMac ? 'Meta' : 'Control';
  return shortcut === 'save' ? `${modifier}+S` : `F5 ${modifier}+R`;
}

export function registerKeyboardShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return;
    const primaryModifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    const key = event.key.toLowerCase();
    const shortcut = primaryModifier && key === 's'
      ? 'save'
      : (primaryModifier && key === 'r') || (event.key === 'F5' && !event.ctrlKey && !event.metaKey)
        ? 'refresh'
        : undefined;
    if (!shortcut) return;

    const selector = `[data-keyboard-shortcut="${shortcut}"]`;
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
      .filter((dialog) => dialog.getClientRects().length > 0 && !dialog.closest('[inert], [aria-hidden="true"]'));
    const root = dialogs.at(-1) ?? document.body;
    let scope = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
      ? document.activeElement.closest<HTMLElement>('[data-shortcut-scope]') ?? root
      : root;
    if (!root.contains(scope)) scope = root;
    const buttons = Array.from(scope.querySelectorAll<HTMLElement>(selector))
      .filter((button) => button.getClientRects().length > 0 && !button.closest('[inert], [aria-hidden="true"]'));
    if (!buttons.length) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    const button = buttons[0];
    if (!button.matches(':disabled, [disabled], [aria-disabled="true"]')) button.click();
  });
}
