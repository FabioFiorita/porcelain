import { FileQuestionIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/shared/lib/utils';
import { type ChangeScope, isChangeScope } from '@/shared/workspace/search';
import { useAccessStore } from '@/features/access/index';
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { useMarkCommentsSeen } from '../commands/comments';
import { useComments, usePrefetchComments } from '../queries/comments';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  type CommentAnchor,
  anchorPath,
  changeAnchor,
  commentsSeenThrough,
  type CommentThread,
} from '../rules/comments';
import {
  BRANCH,
  type DocumentRef,
  entryKey,
  UNEXPLAINED,
} from '../rules/documents';
import {
  type ChangeList,
  notExplainedLabel,
  type ReviewChangeItem,
  type ReviewResponse,
  type ReviewScope,
} from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';
import { BranchIndex } from './branch-index';
import { ChangeRow, ROW } from './change-row';
import { InlineComposer } from './inline-composer';
import { ThreadCard } from './thread-card';

type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;
type Props = {
  scope: ReviewScope;
  context: ReviewsContext;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};
type ScopeProps = {
  changeScope: ChangeScope;
  base: string | undefined;
  onChangeScope: (scope: ChangeScope) => void;
  onBase: (base: string | undefined) => void;
};

export function ReviewIndex({
  scope,
  context,
  activeEntry,
  onOpen,
  changeScope,
  base,
  onChangeScope,
  onBase,
}: Props & ScopeProps) {
  const connection = useAccessStore((state) => state.connection);
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  usePrefetchReviewed(scope, context);
  usePrefetchComments(scope, context);
  const { changes: list } = useChanges(scope, connection);
  const published = usePublishedReview(scope, context);
  const review = published.data?.active ? published.data : null;
  const { threads } = useComments(scope, context);
  const changes = useReviewChangeItems(scope, context, list);
  const openComments = threads.filter((thread) => !thread.resolved).length;

  const branch = changeScope === 'branch';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2">
        <Tabs
          value={changeScope}
          onValueChange={(value: unknown) => {
            if (isChangeScope(value)) onChangeScope(value);
          }}
        >
          <TabsList
            variant="line"
            className="w-full"
            aria-label="Changes to review"
          >
            <TabsTrigger value="uncommitted" className="flex-1">
              Uncommitted
            </TabsTrigger>
            <TabsTrigger value="branch" className="flex-1">
              Branch
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="shrink-0 px-2 pt-2">
        <Tabs
          value={view}
          onValueChange={(value: unknown) => {
            if (value === 'layers' || value === 'comments') setView(value);
          }}
          aria-label="Review views"
        >
          <TabsList className="h-8 w-full">
            <TabsTrigger value="layers" className="flex-1">
              {review && !branch ? 'Layers' : 'Changed files'}
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
      {view === 'layers' && branch ? (
        <BranchIndex
          scope={scope}
          context={context}
          base={base}
          activeEntry={activeEntry}
          threads={threads}
          onOpen={onOpen}
          onBase={onBase}
        />
      ) : view === 'layers' ? (
        <LayersView
          scope={scope}
          context={context}
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
          branch={branch}
          base={base}
          scope={scope}
          context={context}
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
  review: ReviewResponse | null | undefined;
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
          <button
            type="button"
            className={ROW}
            aria-pressed={activeEntry === 'unexplained'}
            onClick={() => onOpen(UNEXPLAINED)}
          >
            <FileQuestionIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">
              Not explained
              <span className="text-muted-foreground">
                {' · '}
                {notExplainedLabel(review.notExplained) ?? 'nothing'}
              </span>
            </span>
          </button>
        )}
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
            document={{ kind: 'change', path }}
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
                (thread) =>
                  anchorPath(thread.anchor) === path && !thread.resolved,
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

function ChangeComment({
  scope,
  context,
  anchor,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
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
        disabled={anchor == null}
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlusIcon data-icon="inline-start" />
        {branch ? 'Comment on the whole branch' : 'Comment on the whole change'}
      </Button>
    </div>
  );
}

function BranchChangeComment({
  scope,
  context,
  base,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  base: string | undefined;
}) {
  const connection = useAccessStore((state) => state.connection);
  const changes = useBranchChanges(scope, connection, base);
  const ref = changes.data?.base?.ref;
  const tip = changes.data?.head.oid;
  return (
    <ChangeComment
      scope={scope}
      context={context}
      anchor={
        ref == null || tip == null
          ? undefined
          : changeAnchor({ base: ref, tip })
      }
    />
  );
}

function CommentsView({
  scope,
  context,
  list,
  threads,
  branch,
  base,
  onOpen,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  list: ChangeList;
  threads: readonly CommentThread[];
  branch: boolean;
  base: string | undefined;
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

  const snapshot = threads
    .map((thread) => `${thread.id}:${thread.revision}`)
    .sort()
    .join('\n');
  const highest = threads.reduce(
    (top, thread) => Math.max(top, thread.revision),
    0,
  );
  const markSeen = useMarkCommentsSeen(scope, context).mutate;
  const shown = useRef({ snapshot: '', filters: new Set<string>() });
  useEffect(() => {
    if (shown.current.snapshot !== snapshot)
      shown.current = { snapshot, filters: new Set() };
    shown.current.filters.add(filter);
    const through = commentsSeenThrough(
      { highest, open: openCount, resolved: resolvedCount },
      shown.current.filters,
    );
    if (through !== null) markSeen(through);
  }, [filter, highest, markSeen, openCount, resolvedCount, snapshot]);

  const reveal = (anchor: CommentAnchor) => {
    if (anchor.kind === 'change') {
      onOpen(
        anchor.comparison?.kind === 'branch' ? BRANCH : { kind: 'handoff' },
        anchor,
      );
      return;
    }
    const ref: DocumentRef =
      anchor.comparison?.kind === 'branch'
        ? { kind: 'branch-file', path: anchor.filePath }
        : anchor.revision != null
          ? { kind: 'commit', oid: anchor.revision }
          : anchor.comparison?.kind !== 'file' && changed.has(anchor.filePath)
            ? { kind: 'change', path: anchor.filePath }
            : { kind: 'file', path: anchor.filePath };
    onOpen(ref, anchor);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {branch ? (
        <BranchChangeComment scope={scope} context={context} base={base} />
      ) : (
        <ChangeComment
          scope={scope}
          context={context}
          anchor={changeAnchor(undefined)}
        />
      )}
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
