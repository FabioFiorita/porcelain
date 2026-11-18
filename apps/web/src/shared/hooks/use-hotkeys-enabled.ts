import { useDefaultHotkeysOptions } from '@tanstack/react-hotkeys';

export function useHotkeysEnabled() {
  return useDefaultHotkeysOptions().hotkey?.enabled !== false;
}
