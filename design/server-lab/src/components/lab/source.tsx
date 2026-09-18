import { File } from '@pierre/diffs/react';
import { cn } from 'cn';
import { Copy, FileCode2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import type { SourceRef } from '@/map/types';
import {
  enclosingSnippet,
  PIERRE_THEME,
  SURFACE_CSS,
  useHighlighterReady,
  useSourceFile,
  useThemeType,
} from './code';

// Opened files live in a docked pane beside the page, like editor tabs.
type PaneState = { tabs: SourceRef[]; active: number };
let pane: PaneState = { tabs: [], active: 0 };
const listeners = new Set<() => void>();
const publish = (next: PaneState) => {
  pane = next;
  for (const listener of listeners) listener();
};

export function openSource(ref: SourceRef) {
  const existing = pane.tabs.findIndex((tab) => tab.path === ref.path);
  if (existing >= 0) {
    const tabs = [...pane.tabs];
    tabs[existing] = ref;
    publish({ tabs, active: existing });
    return;
  }
  const tabs = [...pane.tabs, ref].slice(-8);
  publish({ tabs, active: tabs.length - 1 });
}

function closeTab(index: number) {
  const tabs = pane.tabs.filter((_, position) => position !== index);
  publish({
    tabs,
    active: Math.min(pane.active, Math.max(0, tabs.length - 1)),
  });
}

export function useCodePane() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pane,
  );
}

export function SourceLink({
  source,
  className,
  children,
}: {
  source: SourceRef;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => openSource(source)}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
        className,
      )}
      title="Open in the code pane"
    >
      <FileCode2 className="size-3 shrink-0" />
      <span className="truncate">
        {children ?? `${source.path}${source.line ? `:${source.line}` : ''}`}
      </span>
    </button>
  );
}

const basename = (path: string) => path.split('/').at(-1) ?? path;

/** The whole file in Pierre, the referenced declaration selected and scrolled into view. */
export function CodePane() {
  const { tabs, active } = useCodePane();
  const source = tabs[active];
  const query = useSourceFile(source?.path);
  const themeType = useThemeType();
  const ready = useHighlighterReady();
  const host = useRef<HTMLDivElement>(null);
  const content = query.data?.content;
  const range = useMemo(
    () =>
      content !== undefined && source?.line && !source.path.endsWith('.md')
        ? enclosingSnippet(content, source.line)
        : undefined,
    [content, source?.line, source?.path],
  );
  const file = useMemo(
    () =>
      content !== undefined && source
        ? { name: source.path, contents: content }
        : undefined,
    [content, source],
  );
  const options = useMemo(
    () => ({
      theme: PIERRE_THEME,
      themeType,
      disableFileHeader: true,
      overflow: source?.path.endsWith('.md')
        ? ('wrap' as const)
        : ('scroll' as const),
      unsafeCSS: SURFACE_CSS,
    }),
    [themeType, source?.path],
  );
  const selected = useMemo(
    () => (range ? { start: range.start, end: range.end } : null),
    [range],
  );
  useEffect(() => {
    if (!range || !file || !ready) return;
    let attempts = 0;
    // Pierre renders asynchronously into a shadow root; wait for the row.
    const timer = setInterval(() => {
      const root = host.current?.querySelector('diffs-container')?.shadowRoot;
      const row = root?.querySelector(`[data-column-number="${range.start}"]`);
      if (row || ++attempts > 40) {
        clearInterval(timer);
        row?.scrollIntoView({ block: 'start' });
        host.current?.scrollBy({ top: -48 });
      }
    }, 50);
    return () => clearInterval(timer);
  }, [range, file, ready]);
  if (!source) return null;
  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      <div className="flex items-center border-b">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab, index) => (
            <div
              key={tab.path}
              className={cn(
                'group flex shrink-0 items-center gap-1 border-r px-2.5 py-1.5 text-xs',
                index === active
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              title={tab.path}
            >
              <button
                type="button"
                onClick={() => publish({ tabs, active: index })}
                className="font-mono"
              >
                {basename(tab.path)}
                {tab.line ? `:${tab.line}` : ''}
              </button>
              <button
                type="button"
                onClick={() => closeTab(index)}
                className="rounded p-0.5 opacity-50 hover:bg-muted hover:opacity-100"
                aria-label={`Close ${tab.path}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => publish({ tabs: [], active: 0 })}
          aria-label="Close the code pane"
        >
          <X />
        </Button>
      </div>
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">
          {source.path}
          {range
            ? `:${range.start}–${range.end}`
            : source.line
              ? `:${source.line}`
              : ''}
        </span>
        {source.symbol && <span className="font-mono">{source.symbol}</span>}
        <Button
          size="xs"
          variant="ghost"
          onClick={() =>
            navigator.clipboard.writeText(
              `${source.path}${source.line ? `:${source.line}` : ''}`,
            )
          }
        >
          <Copy /> Copy path
        </Button>
      </div>
      <div ref={host} className="min-h-0 flex-1 overflow-auto">
        {query.isError && (
          <div className="p-4 text-sm text-muted-foreground">
            {String(query.error)}
          </div>
        )}
        {file && ready ? (
          <File file={file} options={options} selectedLines={selected} />
        ) : (
          !query.isError && (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          )
        )}
      </div>
    </div>
  );
}
