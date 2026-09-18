import { preloadHighlighter } from '@pierre/diffs';
import { File } from '@pierre/diffs/react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Maximize2 } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { labApi } from '@/lib/lab';
import type { SourceRef } from '@/map/types';
import { enclosingSnippet } from './snippet';
import { openSource } from './source';

export const PIERRE_THEME = {
  light: 'pierre-light',
  dark: 'pierre-dark',
} as const;

// Files created while the shared highlighter is still loading can stay empty
// (seen with several on one page), so load it once and render code only after.
let highlighterReady = false;
const readyListeners = new Set<() => void>();
void preloadHighlighter({
  themes: ['pierre-light', 'pierre-dark'],
  langs: [
    'typescript',
    'tsx',
    'javascript',
    'json',
    'markdown',
    'sql',
    'yaml',
    'css',
  ],
}).then(() => {
  highlighterReady = true;
  for (const listener of readyListeners) listener();
});
export function useHighlighterReady() {
  return useSyncExternalStore(
    (listener) => {
      readyListeners.add(listener);
      return () => readyListeners.delete(listener);
    },
    () => highlighterReady,
  );
}

/** Code sits on the card instead of the theme's own page colour (see design/prototype). */
export const SURFACE_CSS = `
:host {
  --diffs-light-bg: var(--card) !important;
  --diffs-dark-bg: var(--card) !important;
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
`;

const dark =
  typeof window === 'undefined'
    ? undefined
    : window.matchMedia('(prefers-color-scheme: dark)');
export function useThemeType(): 'light' | 'dark' {
  return useSyncExternalStore(
    (listener) => {
      dark?.addEventListener('change', listener);
      return () => dark?.removeEventListener('change', listener);
    },
    () => (dark?.matches ? 'dark' : 'light'),
  );
}

export function useSourceFile(path: string | undefined) {
  return useQuery({
    queryKey: ['source', path],
    queryFn: () =>
      labApi<{ content: string }>(
        `/source?${new URLSearchParams({ path: path ?? '' })}`,
      ),
    enabled: Boolean(path),
    staleTime: 5_000,
  });
}

export { enclosingSnippet } from './snippet';

/** Pierre-rendered code behind one part of a flow. */
export function CodeSnippet({
  source,
  defaultOpen = true,
  title,
}: {
  source: SourceRef;
  defaultOpen?: boolean;
  title?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const query = useSourceFile(open ? source.path : undefined);
  const themeType = useThemeType();
  const ready = useHighlighterReady();
  const markdown = source.path.endsWith('.md');
  const snippet = useMemo(() => {
    const content = query.data?.content;
    if (content === undefined) return undefined;
    if (markdown || !source.line) {
      const lines = content.split('\n');
      const end = Math.min(lines.length, markdown ? lines.length : 60);
      return { start: 1, end, text: lines.slice(0, end).join('\n') };
    }
    const range = enclosingSnippet(content, source.line);
    return {
      ...range,
      text: content
        .split('\n')
        .slice(range.start - 1, range.end)
        .join('\n'),
    };
  }, [query.data, source.line, markdown]);
  const file = useMemo(
    () => (snippet ? { name: source.path, contents: snippet.text } : undefined),
    [snippet, source.path],
  );
  // The referenced line, relative to the snippet.
  const focus = useMemo(() => {
    if (!snippet || !source.line || (snippet.start === 1 && snippet.end > 60))
      return null;
    const row = source.line - snippet.start + 1;
    return row >= 1 && row <= snippet.end - snippet.start + 1
      ? { start: row, end: row }
      : null;
  }, [snippet, source.line]);
  const options = useMemo(
    () => ({
      theme: PIERRE_THEME,
      themeType,
      disableFileHeader: true,
      // Pierre numbers from 1; the header shows the real range instead.
      disableLineNumbers: true,
      overflow: markdown ? ('wrap' as const) : ('scroll' as const),
      unsafeCSS: SURFACE_CSS,
    }),
    [themeType, markdown],
  );
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-2 py-1 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex min-w-0 flex-1 items-center gap-1 text-left hover:text-foreground"
        >
          <ChevronRight
            className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          {title ?? null}
          <span className="truncate font-mono">
            {source.path}
            {snippet && snippet.start !== 1
              ? `:${snippet.start}–${snippet.end}`
              : source.line
                ? `:${source.line}`
                : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            openSource({
              ...source,
              ...(snippet ? { line: source.line ?? snippet.start } : {}),
            })
          }
          className="inline-flex shrink-0 items-center gap-1 hover:text-foreground"
          title="Open the whole file"
        >
          <Maximize2 className="size-3" /> Open file
        </button>
      </div>
      {open && (
        <div className="max-h-[480px] overflow-auto">
          {query.isError && (
            <p className="p-3 text-xs text-muted-foreground">
              {String(query.error)}
            </p>
          )}
          {file && ready ? (
            <File file={file} options={options} selectedLines={focus} />
          ) : (
            !query.isError && (
              <p className="p-3 text-xs text-muted-foreground">Loading…</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
