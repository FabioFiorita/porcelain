import { TruncatedText } from '@/shared/views/truncated-text';
import { relativeTime } from '@/shared/lib/relative-time';
import { Columns2Icon, CopyIcon, GitMergeIcon } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
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
  shownRefs,
  type CommitSummary,
} from '@porcelain/client/history/rules';
import { CommitRefs } from './commit-refs';

export type CommitRowLayout = 'stacked' | 'columns';

export function CommitRow({
  commit,
  selected,
  height,
  inset,
  layout = 'stacked',
  head = false,
  headRef,
  onSelect,
  openToSide,
  children,
}: {
  commit: CommitSummary;
  selected: boolean;
  height?: number | undefined;
  inset?: number | undefined;
  layout?: CommitRowLayout;
  head?: boolean;
  headRef?: string | undefined;
  onSelect: (toSide?: boolean) => void;
  openToSide?: { label: string; open: () => void };
  children?: ReactNode;
}) {
  const [openingSide, setOpeningSide] = useState(false);
  const select = (event: MouseEvent<HTMLButtonElement>) =>
    onSelect(openToSide !== undefined && event.altKey);
  const current = (ref: string) =>
    headRef !== undefined && (ref === headRef || ref === refLabel(headRef));
  const refs = shownRefs(commit.refs).toSorted(
    (left, right) => Number(current(right)) - Number(current(left)),
  );
  const subject = (
    <span className="flex min-w-0 items-center gap-1 text-caption leading-tight">
      {commit.parentOids.length > 1 && (
        <GitMergeIcon
          aria-label="Merge commit"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      )}
      <TruncatedText text={commit.subject} />
    </span>
  );
  const age = relativeTime(commit.author.timestamp);
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
              'relative flex w-full rounded-lg px-2 text-left transition-colors hover:bg-accent',
              layout === 'stacked'
                ? 'flex-col justify-center gap-0.5'
                : 'items-center gap-3',
              height === undefined && 'py-1.5',
              selected && 'bg-accent',
            )}
          />
        }
      >
        {layout === 'stacked' ? (
          <>
            <button
              type="button"
              aria-pressed={selected}
              onClick={select}
              className="flex w-full min-w-0 flex-col gap-0.5 text-left before:absolute before:inset-0 before:rounded-lg"
            >
              {subject}
              <span className="flex gap-1.5 text-2xs text-muted-foreground">
                <code className="font-mono">{shortOid(commit.oid)}</code>
                <TruncatedText text={commit.author.name} />
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{age}</span>
              </span>
              {children}
            </button>
            {refs.length > 0 && (
              <CommitRefs refs={refs} current={current} onOpenCommit={select} />
            )}
          </>
        ) : (
          <>
            <code className="hidden w-16 shrink-0 font-mono text-2xs text-muted-foreground @md/graph:block">
              {shortOid(commit.oid)}
            </code>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                aria-pressed={selected}
                onClick={select}
                className="flex max-w-3/5 min-w-0 shrink-0 items-center text-left before:absolute before:inset-0 before:rounded-lg"
              >
                {subject}
                <span className="sr-only">
                  {` ${shortOid(commit.oid)} ${commit.author.name} ${age}`}
                </span>
              </button>
              {head && (
                <Badge variant="brand" className="relative h-4 shrink-0">
                  HEAD
                </Badge>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                {refs.length > 0 && (
                  <CommitRefs
                    refs={refs}
                    current={current}
                    onOpenCommit={select}
                  />
                )}
              </div>
            </div>
            <TruncatedText
              className="hidden w-28 shrink-0 text-2xs text-muted-foreground @2xl/graph:block"
              text={commit.author.name}
            />
            <span
              aria-hidden="true"
              className="shrink-0 text-right text-2xs whitespace-nowrap text-muted-foreground tabular-nums"
            >
              {age}
            </span>
          </>
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
