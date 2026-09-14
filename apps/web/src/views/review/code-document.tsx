import type { CodeViewItem, FileDiffMetadata } from '@pierre/diffs';
import { CodeView, type CodeViewReactOptions } from '@pierre/diffs/react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PIERRE_SURFACE_CSS, PIERRE_THEME } from '../../lib/pierre';
import { useTheme } from '../workspace/theme';

export type CodeEntry =
  | {
      id: string;
      kind: 'diff';
      path: string;
      fileDiff: FileDiffMetadata;
      version: number;
      note?: string;
    }
  | {
      id: string;
      kind: 'file';
      path: string;
      contents: string;
      version: number;
      note?: string;
    };

export function CodeDocument({
  entries,
  header,
}: {
  entries: readonly CodeEntry[];
  header?: () => ReactNode;
}) {
  const { dark } = useTheme();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const byId = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );
  const items = useMemo<CodeViewItem<undefined>[]>(
    () =>
      entries.map((entry) => {
        const shared = {
          id: entry.id,
          collapsed: collapsed.has(entry.id),
          version: entry.version * 2 + (collapsed.has(entry.id) ? 1 : 0),
        };
        return entry.kind === 'diff'
          ? { ...shared, type: 'diff' as const, fileDiff: entry.fileDiff }
          : {
              ...shared,
              type: 'file' as const,
              file: { name: entry.path, contents: entry.contents },
            };
      }),
    [collapsed, entries],
  );
  const options = useMemo<CodeViewReactOptions<undefined, undefined>>(
    () => ({
      theme: PIERRE_THEME,
      themeType: dark ? 'dark' : 'light',
      overflow: 'scroll',
      diffStyle: 'unified',
      diffIndicators: 'classic',
      hunkSeparators: 'line-info',
      stickyHeaders: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
      layout: { paddingTop: 12, paddingBottom: 96, gap: 12 },
    }),
    [dark],
  );
  const allCollapsed =
    entries.length > 0 && entries.every((entry) => collapsed.has(entry.id));

  const setAllCollapsed = (next: boolean) =>
    setCollapsed(next ? new Set(entries.map((entry) => entry.id)) : new Set());
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {entries.length > 1 && (
        <div className="flex shrink-0 justify-end border-b px-3 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAllCollapsed(!allCollapsed)}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Button>
        </div>
      )}
      <CodeView
        items={items}
        options={options}
        className="min-h-0 flex-1 overflow-auto"
        {...(header ? { renderCodeViewHeader: header } : {})}
        renderHeaderPrefix={(item) => {
          if (entries.length < 2) return null;
          const entry = byId.get(item.id);
          if (!entry) return null;
          const isCollapsed = collapsed.has(item.id);
          return (
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${entry.path}`}
              onClick={() => toggle(item.id)}
              className="-ml-1 grid size-5 place-items-center rounded-md font-sans text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {isCollapsed ? (
                <ChevronRightIcon className="size-3.5" />
              ) : (
                <ChevronDownIcon className="size-3.5" />
              )}
            </button>
          );
        }}
        renderHeaderFilenameSuffix={(item) => {
          const note = byId.get(item.id)?.note;
          return note ? (
            <span className="ml-2 truncate font-sans text-xs text-muted-foreground">
              {note}
            </span>
          ) : null;
        }}
      />
    </div>
  );
}
