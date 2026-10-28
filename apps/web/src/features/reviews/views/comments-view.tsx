import { MessageSquarePlusIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { cn } from '@/shared/lib/utils';
import type {
  CommentAnchor,
  CommentThread,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { useVisibleComments } from '../commands/comments';
import { DeleteResolved } from './delete-resolved';
import { InlineComposer } from './inline-composer';
import { SegmentedTabs } from './segmented-tabs';
import { ThreadCard } from './thread-card';

export function ReviewViews({
  view,
  onView,
  filesLabel,
  openComments,
}: {
  view: 'layers' | 'comments';
  onView: (view: 'layers' | 'comments') => void;
  filesLabel: string;
  openComments: number;
}) {
  return (
    <SegmentedTabs
      label="Review views"
      className="px-2.5 pt-3.5"
      value={view}
      onValue={onView}
      options={[
        { value: 'layers', label: filesLabel },
        {
          value: 'comments',
          label:
            openComments > 0 ? (
              <>
                Comments <span className="tabular-nums">({openComments})</span>
              </>
            ) : (
              'Comments'
            ),
        },
      ]}
    />
  );
}

export function WholeChangeComment({
  target,
  branch,
  onCompose,
}: {
  target: HTMLElement | null;
  branch: boolean;
  onCompose: () => void;
}) {
  if (!target) return null;
  const label = branch
    ? 'Comment on the whole branch'
    : 'Comment on the whole change';
  return createPortal(
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            onClick={onCompose}
          />
        }
      >
        <MessageSquarePlusIcon className="text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent role="tooltip">{label}</TooltipContent>
    </Tooltip>,
    target,
  );
}

export function ChangeComment({
  scope,
  context,
  anchor,
  open,
  setOpen,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  anchor: CommentAnchor | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const branch = anchor?.comparison?.kind === 'branch';
  if (open && anchor)
    return (
      <InlineComposer
        scope={scope}
        context={context}
        anchor={anchor}
        onClose={() => setOpen(false)}
      />
    );
  return (
    <div className="shrink-0 px-2 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={anchor === null || anchor === undefined}
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlusIcon data-icon="inline-start" />
        {branch ? 'Comment on the whole branch' : 'Comment on the whole change'}
      </Button>
    </div>
  );
}

export function CommentsView({
  scope,
  context,
  threads,
  composer,
  onReveal,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  threads: readonly CommentThread[];
  composer: ReactNode;
  onReveal: (anchor: CommentAnchor) => void;
}) {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const visible = [...threads]
    .filter((thread) => thread.resolved === (filter === 'resolved'))
    .sort((left, right) =>
      lastActivity(left).localeCompare(lastActivity(right)),
    );
  const openCount = threads.filter((thread) => !thread.resolved).length;
  const resolvedCount = threads.length - openCount;
  const counts = { open: openCount, resolved: resolvedCount };
  const empty =
    filter === 'open' ? 'No open comments yet.' : 'Nothing resolved yet.';

  useVisibleComments(scope, context, scope.review ? undefined : filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {composer}
      <div className="flex shrink-0 gap-1 px-2 pt-2">
        {(['open', 'resolved'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-md px-2 py-1 text-2xs capitalize text-muted-foreground transition-colors hover:bg-accent',
              filter === value && 'bg-accent text-foreground',
            )}
          >
            {value} <span className="tabular-nums">{counts[value]}</span>
          </button>
        ))}
        {filter === 'resolved' && resolvedCount > 0 && (
          <DeleteResolved scope={scope} context={context} threads={threads} />
        )}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-muted-foreground">
          {empty}
        </p>
      ) : (
        <MessageScrollerProvider
          key={filter}
          autoScroll
          defaultScrollPosition="end"
        >
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Comments">
              <MessageScrollerContent
                className={cn('', filter === 'open' ? '' : '')}
              >
                {visible.map((thread, index) => (
                  <MessageScrollerItem
                    key={thread.id}
                    messageId={thread.id}
                    scrollAnchor={index === visible.length - 1}
                  >
                    <ThreadCard
                      thread={thread}
                      scope={scope}
                      context={context}
                      onReveal={() => onReveal(thread.anchor)}
                    />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}
    </div>
  );
}

function lastActivity(thread: CommentThread) {
  return thread.messages.at(-1)?.createdAt ?? '';
}
