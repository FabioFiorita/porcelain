import { useHotkey } from '@tanstack/react-hotkeys';

export function useQuickOpenShortcut(toggle: () => void) {
  useHotkey('Mod+P', toggle, { enabled: true });
}
