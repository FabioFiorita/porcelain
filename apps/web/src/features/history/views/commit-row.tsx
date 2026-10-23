import { TruncatedText } from '@/shared/views/truncated-text';
import { relativeTime } from '@/shared/lib/relative-time';
import { Columns2Icon, CopyIcon, GitMergeIcon } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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
  shortOid,
  type CommitSummary,
} from '@porcelain/client/history/rules';
import { CommitRefs } from './commit-refs';

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
  const select = (event: MouseEvent<HTMLButtonElement>) =>
    onSelect(openToSide !== undefined && event.altKey);
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setOpeningSide(false);
      }}
    >
      <ContextMenuTrigger
        render={
          <div
            style={{ height, paddingLeft: inset }}
            className={cn(
              'relative flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
              height === undefined && 'py-1.5',
              selected && 'bg-accent',
            )}
          />
        }
      >
        <button
          type="button"
          aria-pressed={selected}
          onClick={select}
          className="flex w-full min-w-0 flex-col gap-0.5 text-left before:absolute before:inset-0 before:rounded-lg"
        >
          <span className="flex min-w-0 items-center gap-1 text-caption leading-tight">
            {commit.parentOids.length > 1 && (
              <GitMergeIcon
                aria-label="Merge commit"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            )}
            <TruncatedText text={commit.subject} />
          </span>
          <span className="flex gap-1.5 text-2xs text-muted-foreground">
            <code className="font-mono">{shortOid(commit.oid)}</code>
            <TruncatedText text={commit.author.name} />
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {relativeTime(commit.author.timestamp)}
            </span>
          </span>
          {children}
        </button>
        {commit.refs.length > 0 && (
          <CommitRefs refs={commit.refs} onOpenCommit={select} />
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
