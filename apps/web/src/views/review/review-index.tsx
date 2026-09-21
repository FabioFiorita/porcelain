import { CheckIcon, MessageSquareIcon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CommentAnchor, CommentThread } from '../../domain/comments';
import type { DocumentRef } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import {
  basename,
  type ChangeList,
  type ReviewChangeItem,
  type ReviewScope,
  type ReviewStatus,
} from '../../domain/review';
import {
  useComments,
  useMarkCommentsSeen,
  usePrefetchComments,
} from '../../query/comments';
import { usePublishedReview } from '../../query/published-review';
import {
  useChanges,
  usePrefetchReview,
  useReviewChanges,
} from '../../query/review';
import { FileTypeIcon } from './file-type-icon';
import { ThreadCard } from './thread-card';

type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;
type Props = {
  scope: ReviewScope;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

const ROW =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-accent';

/** The Review surface: layers in reading order, changed files, and comments. */
export function ReviewIndex({ scope, activeEntry, onOpen }: Props) {
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  usePrefetchReview(scope);
  usePrefetchComments(scope);
  const { changes: list } = useChanges(scope);
  const published = usePublishedReview(scope);
  const review = published.data?.active ? published.data : null;
  const { threads } = useComments(scope);
  const changes = useReviewChanges(scope);
  const openComments = threads.filter((thread) => !thread.resolved).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as typeof view)}
          aria-label="Review views"
        >
          <TabsList className="h-8 w-full">
            <TabsTrigger value="layers" className="flex-1 text-xs">
              {review ? 'Layers' : 'Changed files'}
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 gap-1.5 text-xs">
              Comments
              {openComments > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[10px]"
                >
                  {openComments}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === 'layers' ? (
        <LayersView
          scope={scope}
          activeEntry={activeEntry}
          onOpen={onOpen}
          list={list}
          review={review}
          changes={changes}
          threads={threads}
        />
      ) : (
        <CommentsView
          list={list}
          threads={threads}
          scope={scope}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function LayersView({
  activeEntry,
  onOpen,
  list,
  review,
  changes,
  threads,
}: Props & {
  list: ChangeList;
  review: import('../../domain/review').ReviewResponse | null | undefined;
  changes: readonly ReviewChangeItem[];
  threads: readonly CommentThread[];
}) {
  const paths = list.changes.map((entry) => entry.path);
  const changeByPath = new Map(changes.map((item) => [item.path, item]));
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="p-2">
        <button
          type="button"
          className={ROW}
          aria-pressed={activeEntry === 'handoff'}
          onClick={() => onOpen({ kind: 'handoff' })}
        >
          {review ? 'Review summary' : 'All changes'}
        </button>
        {review?.layers.map((layer, index) => (
          <button
            key={layer.id}
            type="button"
            className={ROW}
            aria-pressed={activeEntry === `layer:${layer.id}`}
            onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
          >
            <span className="text-muted-foreground">{index + 1}.</span>
            {layer.title}
          </button>
        ))}
        {review && (
          <p className="px-2 pt-4 pb-1 text-xs text-muted-foreground">
            Changed files
          </p>
        )}
        {paths.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No changes</p>
        )}
        {paths.map((path) => (
          <ChangeRow
            key={path}
            path={path}
            note={undefined}
            scopes={[
              ...new Set(
                list.changes
                  .find((entry) => entry.path === path)
                  ?.comparisons.map((change) => change.scope),
              ),
            ]}
            reviewStatus={changeByPath.get(path)?.reviewStatus}
            commentCount={
              threads.filter(
                (thread) => thread.anchor.filePath === path && !thread.resolved,
              ).length
            }
            active={activeEntry === entryKey({ kind: 'change', path })}
            onOpen={onOpen}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ChangeRow({
  path,
  note,
  scopes,
  reviewStatus,
  commentCount,
  active,
  onOpen,
  indented = false,
}: {
  path: string;
  note: string | undefined;
  scopes: readonly string[];
  reviewStatus: ReviewStatus | undefined;
  commentCount: number;
  active: boolean;
  onOpen: OpenDocument;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`}
      title={note == null ? path : `${path}\n${note}`}
      className={cn(
        ROW,
        'text-muted-foreground',
        indented && 'pl-7',
        active && 'bg-accent font-medium text-foreground',
      )}
      onClick={() => onOpen({ kind: 'change', path })}
    >
      <ReviewStatusIcon status={reviewStatus} />
      <FileTypeIcon path={path} className="size-3.5 shrink-0" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          reviewStatus === 'reviewed' &&
            'line-through decoration-muted-foreground/40',
        )}
      >
        {basename(path)}
      </span>
      {commentCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10.5px]">
          <MessageSquareIcon className="size-3" />
          {commentCount}
        </span>
      )}
    </button>
  );
}

function ReviewStatusIcon({ status }: { status: ReviewStatus | undefined }) {
  const normalized = status ?? 'unreviewed';
  return (
    <span
      className="grid w-3.5 shrink-0 place-items-center"
      data-review-state={normalized}
      title={reviewStatusLabel(status)}
    >
      {normalized === 'reviewed' ? (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : normalized === 'stale' ? (
        <RotateCcwIcon className="size-3 text-amber-600 dark:text-amber-400" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      )}
    </span>
  );
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}

function CommentsView({
  scope,
  list,
  threads,
  onOpen,
}: {
  scope: ReviewScope;
  list: ChangeList;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
}) {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const changed = new Set(list.changes.map((entry) => entry.path));
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

  // Reading the discussion is what clears the dot — not fetching it, which
  // happens on mount and from every code document.
  //
  // The acknowledgement is one number per worktree, so it can only be moved
  // once *everything* below it has been on screen: acknowledging the newest
  // open thread would otherwise bury an older unread reply sitting in the
  // resolved list. Both filters therefore have to have been shown for this
  // same set of threads, and a set that changes starts the proof again.
  const snapshot = threads
    .map((thread) => `${thread.id}:${thread.revision}`)
    .sort()
    .join('\n');
  const highest = threads.reduce(
    (top, thread) => Math.max(top, thread.revision),
    0,
  );
  const markSeen = useMarkCommentsSeen(scope).mutate;
  const shown = useRef({ snapshot: '', filters: new Set<string>() });
  useEffect(() => {
    if (shown.current.snapshot !== snapshot)
      shown.current = { snapshot, filters: new Set() };
    shown.current.filters.add(filter);
    const needed = (
      [
        ['open', openCount],
        ['resolved', resolvedCount],
      ] as const
    ).filter(([, count]) => count > 0);
    if (
      highest === 0 ||
      !needed.every(([value]) => shown.current.filters.has(value))
    )
      return;
    markSeen(highest);
  }, [filter, highest, markSeen, openCount, resolvedCount, snapshot]);

  const reveal = (anchor: CommentAnchor) => {
    const ref: DocumentRef =
      anchor.revision != null
        ? { kind: 'commit', oid: anchor.revision }
        : anchor.comparison?.kind !== 'file' && changed.has(anchor.filePath)
          ? { kind: 'change', path: anchor.filePath }
          : { kind: 'file', path: anchor.filePath };
    onOpen(ref, anchor);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 px-2 pt-2">
        {(['open', 'resolved'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-md px-2 py-1 text-[11.5px] capitalize text-muted-foreground transition-colors hover:bg-accent',
              filter === value && 'bg-accent text-foreground',
            )}
          >
            {value} <span className="tabular-nums">{counts[value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
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
                className={cn('p-2', filter === 'open' ? 'gap-3' : 'gap-1.5')}
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
                      onReveal={() => reveal(thread.anchor)}
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
