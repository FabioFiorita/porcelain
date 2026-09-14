import type { CodeViewItem, FileDiffMetadata } from '@pierre/diffs';
import { CodeView, type CodeViewReactOptions } from '@pierre/diffs/react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PIERRE_SURFACE_CSS, PIERRE_THEME } from '../../lib/pierre';
import { usePreferences } from '../workspace/preferences';
import { useTheme } from '../workspace/theme';

export type CodeEntry =
  | {
      id: string;
      kind: 'diff';
      path: string;
      fileDiff: FileDiffMetadata;
      version: number;
      note?: string;
      review?: { path: string; control: ReactNode };
    }
  | {
      id: string;
      kind: 'file';
      path: string;
      contents: string;
      version: number;
      note?: string;
      review?: { path: string; control: ReactNode };
    };

export function CodeDocument({
  entries,
  header,
  toolbar,
}: {
  entries: readonly CodeEntry[];
  header?: () => ReactNode;
  toolbar?: () => ReactNode;
}) {
  const { dark } = useTheme();
  const { preferences } = usePreferences();
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
  const firstReviewEntryByPath = useMemo(() => {
    const result = new Map<string, string>();
    for (const entry of entries) {
      if (entry.review && !result.has(entry.review.path))
        result.set(entry.review.path, entry.id);
    }
    return result;
  }, [entries]);
  const options = useMemo<CodeViewReactOptions<undefined, undefined>>(
    () => ({
      theme: PIERRE_THEME,
      themeType: dark ? 'dark' : 'light',
      overflow: preferences.lineOverflow,
      diffStyle: preferences.diffStyle,
      diffIndicators: 'classic',
      hunkSeparators: 'line-info',
      stickyHeaders: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
      layout: { paddingTop: 12, paddingBottom: 96, gap: 12 },
    }),
    [dark, preferences.diffStyle, preferences.lineOverflow],
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
      {toolbar?.()}
      {entries.length === 0 && header && (
        <div
          className="min-h-0 flex-1 overflow-auto"
          data-testid="empty-code-document"
        >
          {header()}
        </div>
      )}
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
      {entries.length > 0 && (
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
            const entry = byId.get(item.id);
            if (!entry) return null;
            const review = entry.review;
            const showControl =
              review != null &&
              firstReviewEntryByPath.get(review.path) === entry.id;
            if (!entry.note && !showControl) return null;
            return (
              <span className="ml-2 inline-flex min-w-0 items-center gap-2 font-sans">
                {entry.note && (
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.note}
                  </span>
                )}
                {showControl && review.control}
              </span>
            );
          }}
        />
      )}
    </div>
  );
}
