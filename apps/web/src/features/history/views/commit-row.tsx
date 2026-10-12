import { relativeTime } from '@/shared/lib/relative-time';
import { Columns2Icon, CopyIcon, GitMergeIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import {
  commitMessage,
  refLabel,
  shortOid,
  type CommitSummary,
} from '@porcelain/client/history/rules';

export function CommitRow({
  commit,
  selected,
  height,
  inset,
  onSelect,
  openToSide,
  children,
}: {
  commit: CommitSummary;
  selected: boolean;
  height?: number | undefined;
  inset?: number | undefined;
  onSelect: (toSide?: boolean) => void;
  openToSide?: { label: string; open: () => void };
  children?: ReactNode;
}) {
  const [openingSide, setOpeningSide] = useState(false);
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setOpeningSide(false);
      }}
    >
      <ContextMenuTrigger
        render={
          <button
            type="button"
            style={{ height, paddingLeft: inset }}
            aria-pressed={selected}
            title={commit.subject}
            onClick={(event) =>
              onSelect(openToSide !== undefined && event.altKey)
            }
            className={cn(
              'flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
              height === undefined && 'py-1.5',
              selected && 'bg-accent',
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1 text-caption leading-tight">
          {commit.parentOids.length > 1 && (
            <GitMergeIcon
              aria-label="Merge commit"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <span className="truncate">{commit.subject}</span>
        </span>
        <span className="flex gap-1.5 text-2xs text-muted-foreground">
          <code className="font-mono">{shortOid(commit.oid)}</code>
          <span className="truncate">{commit.author.name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">
            {relativeTime(commit.author.timestamp)}
          </span>
        </span>
        {children}
        {commit.refs.length > 0 && (
          <span className="flex gap-1 overflow-hidden">
            {commit.refs.map((ref) => (
              <Badge
                key={ref}
                title={ref}
                variant="secondary"
                className="h-4 shrink-0"
              >
                {refLabel(ref)}
              </Badge>
            ))}
          </span>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={!openingSide}>
        {openToSide && (
          <ContextMenuItem
            onClick={() => {
              flushSync(() => setOpeningSide(true));
              openToSide.open();
            }}
          >
            <Columns2Icon />
            {openToSide.label}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => copyText(commit.oid, 'commit id')}>
          <CopyIcon />
          Copy commit id
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => copyText(commitMessage(commit), 'commit message')}
        >
          <CopyIcon />
          Copy message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
