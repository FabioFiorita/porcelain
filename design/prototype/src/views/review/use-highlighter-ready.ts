import { preloadHighlighter } from '@pierre/diffs';
import { useSyncExternalStore } from 'react';
import { PIERRE_THEME } from './pierre';

/**
 * Several Pierre `File`/`FileDiff` components mounted while the shared highlighter
 * is still loading can stay empty (seen in the server lab with a page of snippets).
 * A page of step blocks waits for it once, then renders its code.
 */
let ready = false;
const listeners = new Set<() => void>();

void preloadHighlighter({
  themes: [PIERRE_THEME.light, PIERRE_THEME.dark],
  langs: [
    'typescript',
    'tsx',
    'javascript',
    'jsx',
    'json',
    'markdown',
    'sql',
    'yaml',
    'css',
    'html',
    'shellscript',
  ],
}).then(() => {
  ready = true;
  for (const listener of listeners) listener();
});

export function useHighlighterReady(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => ready,
  );
}
