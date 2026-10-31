import { TruncatedText } from '@/shared/views/truncated-text';
import type { GitStatus, GitStatusEntry } from '@pierre/trees';
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { PinOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type {
  PinnedFileEntry,
  TreeAction,
} from '@porcelain/client/files/rules';
import { FileTreeMenuList } from './file-tree-menu';
import { FileTreeIcon } from './file-tree-icon';
import { FileSectionHeader } from './file-section-header';

const STATUS_MARKS: Partial<Record<GitStatus, string>> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
  untracked: 'U',
};

const PIN_STATES: Record<PinnedFileEntry['state'], string> = {
  resolved: 'Not followed',
  loading: 'Loading…',
  missing: 'Missing',
  unavailable: 'Listing unavailable · Open as file',
};

export function PinnedFiles({
  entries,
  expanded: expandedFolders,
  onExpand,
  onRetry,
  renderDirectory,
  statuses,
  selected,
  onOpen,
  onUnpin,
  menuFor,
}: {
  entries: readonly PinnedFileEntry[];
  expanded: readonly string[];
  onExpand: (path: string, expanded: boolean) => void;
  onRetry: () => void;
  renderDirectory: (path: string) => ReactNode;
  statuses: readonly GitStatusEntry[];
  selected: string;
  onOpen: (path: string, toSide?: boolean) => void;
  onUnpin: (path: string) => void;
  menuFor: (path: string) => {
    actions: readonly { id: TreeAction; label: string }[];
    hidden: boolean;
    onAction: (id: TreeAction) => void;
  };
}) {
  const [openingSide, setOpeningSide] = useState(false);
  if (entries.length === 0) return null;
  const marks = new Map(
    statuses.flatMap((entry) => {
      const mark = STATUS_MARKS[entry.status];
      return mark === undefined ? [] : [[entry.path, mark] as const];
    }),
  );
  return (
    <section aria-label="Pinned files" className="shrink-0 pt-1.5 pb-1">
      <FileSectionHeader label="Pinned" count={entries.length} />
      <ul className="px-4">
        {entries.map((pinned) => {
          const { path } = pinned;
          const directory =
            pinned.state === 'resolved' && pinned.entry.kind === 'directory';
          const open = expandedFolders.includes(path);
          const canOpen =
            pinned.state === 'unavailable' ||
            (pinned.state === 'resolved' &&
              (pinned.entry.kind === 'file' || directory));
          const separator = path.lastIndexOf('/') + 1;
          const menu = menuFor(directory ? `${path}/` : path);
          return (
            <ContextMenu
              key={path}
              onOpenChange={(open) => {
                if (open) setOpeningSide(false);
              }}
            >
              <ContextMenuTrigger
                render={<li className="flex flex-wrap items-center gap-0.5" />}
              >
                <TruncatedText
                  text={path}
                  className="min-w-0"
                  renderTrigger={(label, clip) => (
                    <button
                      type="button"
                      data-file-tree-row=""
                      aria-label={
                        pinned.state === 'unavailable'
                          ? `Open ${path} as file`
                          : path
                      }
                      aria-current={path === selected ? 'page' : undefined}
                      aria-expanded={directory ? open : undefined}
                      disabled={!canOpen}
                      className={cn(
                        'flex h-7.5 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left hover:bg-accent',
                        path === selected && 'bg-accent',
                      )}
                      onClick={(event) =>
                        directory
                          ? onExpand(path, !open)
                          : onOpen(path, event.altKey)
                      }
                    >
                      {directory ? (
                        <FileTreeIcon
                          expanded={open}
                          className="size-4 shrink-0"
                        />
                      ) : (
                        <FileTreeIcon path={path} className="size-4 shrink-0" />
                      )}
                      {label}
                      {separator > 0 &&
                        clip(
                          path.slice(0, separator - 1),
                          'shrink-[100] text-muted-foreground',
                        )}
                      {marks.has(path) && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'ml-auto shrink-0 pl-1 font-mono text-2xs text-muted-foreground',
                            marks.get(path) === STATUS_MARKS.modified &&
                              'text-brand',
                          )}
                        >
                          {marks.get(path)}
                        </span>
                      )}
                    </button>
                  )}
                >
                  {path.slice(separator)}
                </TruncatedText>
                {(!canOpen || pinned.state === 'unavailable') && (
                  <span className="text-2xs text-muted-foreground">
                    {PIN_STATES[pinned.state]}
                  </span>
                )}
                {pinned.state === 'unavailable' && (
                  <Button variant="outline" size="xs" onClick={onRetry}>
                    Try again
                  </Button>
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Unpin ${path}`}
                        onClick={() => onUnpin(path)}
                      />
                    }
                  >
                    <PinOffIcon />
                  </TooltipTrigger>
                  <TooltipContent
                    role="tooltip"
                    className="break-all"
                  >{`Unpin ${path}`}</TooltipContent>
                </Tooltip>
                {directory && open && (
                  <div className="w-full">{renderDirectory(path)}</div>
                )}
              </ContextMenuTrigger>
              <ContextMenuContent finalFocus={!openingSide}>
                <FileTreeMenuList
                  actions={menu.actions}
                  hidden={menu.hidden}
                  onAction={(id) => {
                    if (id === 'open-to-side')
                      flushSync(() => setOpeningSide(true));
                    menu.onAction(id);
                  }}
                />
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </ul>
    </section>
  );
}
