import { formatForDisplay } from '@tanstack/react-hotkeys';
import { useSyncExternalStore } from 'react';
import { SHORTCUTS } from './shortcuts';

/**
 * Whether quick open is showing. A module store so the Files surface's "Go to
 * file" field can open the dialog the workspace owns without threading a prop
 * through the review sidebar.
 */
let open = false;
const listeners = new Set<() => void>();

export function setQuickOpen(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export const openQuickOpen = () => setQuickOpen(true);
export const toggleQuickOpen = () => setQuickOpen(!open);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useQuickOpenState(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}

/** `⌘P` on a Mac, `Ctrl+P` elsewhere. */
export const quickOpenKeys = () => formatForDisplay(SHORTCUTS.quickOpen);
