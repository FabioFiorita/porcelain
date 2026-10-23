import { MessageSquarePlusIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <div className="shrink-0 px-2 pt-2">
      <Tabs
        value={view}
        onValueChange={(value: unknown) => {
          if (value === 'layers' || value === 'comments') onView(value);
        }}
        aria-label="Review views"
      >
        <TabsList className="h-8 w-full">
          <TabsTrigger value="layers" className="flex-1">
            {filesLabel}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex-1">
            Comments
            {openComments > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4">
                {openComments}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

export function ChangeComment({
  scope,
  context,
  anchor,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  anchor: CommentAnchor | undefined;
}) {
  const [open, setOpen] = useState(false);
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
