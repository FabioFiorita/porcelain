import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  CheckIcon,
  CompassIcon,
  FileDiffIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { DiscardButton } from '@/features/git-actions/index';
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
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { useMarkCommentsSeen } from '../commands/comments';
import { useToggleReviewed } from '../commands/reviewed';
import { useComments, usePrefetchComments } from '../queries/comments';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  type CommentAnchor,
  anchorPath,
  changeAnchor,
  commentsSeenThrough,
  type CommentThread,
} from '@porcelain/client/reviews/rules';
import {
  ALL_CHANGES,
  SPECS,
  BRANCH,
  type DocumentRef,
  entryKey,
  PROOF,
  type OpenDocument,
} from '../rules/documents';
import { proofLabel, proofStatus } from '@porcelain/client/reviews/rules';
import type { ReadinessKey } from '@porcelain/client/reviews/rules';
import {
  type ChangeList,
  filesReviewed,
  stopName,
  type WalkthroughKey,
  notExplainedLabel,
  type ReviewChangeItem,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { useWalkthroughPlace } from '../store';
import { BranchIndex } from './branch-index';
import { ChangeRow, ROW } from './change-row';
import { DeleteResolved } from './delete-resolved';
import { InlineComposer } from './inline-composer';
import { BranchReadiness, ChangeReadiness } from './readiness-panel';
import { ThreadCard } from './thread-card';
import { isSpecPath } from '@porcelain/client/reviews/rules';
import { usePreferences } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { useWalkthrough } from '../queries/walkthrough';

type Props = {
  scope: ReviewScope;
  context: ConnectionContext;
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
  const { connection } = context;
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  const { setPlace } = useWalkthroughPlace(scope.worktreeId);
  usePrefetchReviewed(scope, context);
  usePrefetchComments(scope, context);
  const list = useChanges(scope, connection);
  const published = usePublishedReview(scope, context);
  const review = published.review?.active ? published.review : null;
  const { threads } = useComments(scope, context);
  const changes = useReviewChangeItems(scope, context, list);
  const openComments = threads.filter((thread) => !thread.resolved).length;

  const branch = changeScope === 'branch';
  const selectReadiness = (
    key: ReadinessKey,
    firstStale: string | undefined,
  ) => {
    if (key === 'comments' || key === 'replies') {
      setView('comments');
      return;
    }
    setView('layers');
    if (key === 'checks') onOpen(PROOF);
    if (key === 'unexplained') {
      if (review) setPlace('unexplained');
      onOpen({ kind: 'handoff' });
    }
    if (key === 'files') onOpen(branch ? BRANCH : { kind: 'handoff' });
    if (key === 'stale' && firstStale !== undefined)
      onOpen(
        branch
          ? { kind: 'branch-file', path: firstStale }
          : { kind: 'change', path: firstStale },
      );
  };
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
      {branch ? (
        <BranchReadiness
          scope={scope}
          context={context}
          base={base}
          review={review}
          threads={threads}
          onSelect={selectReadiness}
        />
      ) : (
        <ChangeReadiness
          files={changes}
          review={review}
          threads={threads}
          onSelect={selectReadiness}
        />
      )}
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
              {review && !branch ? 'Explore' : 'Changed files'}
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
  scope,
  context,
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
  const { preferences } = usePreferences();
  const paths = list.changes.map((entry) => entry.path);
  const mainPaths = preferences.collapseSpecs
    ? paths.filter((path) => !isSpecPath(path))
    : paths;
  const specPaths = preferences.collapseSpecs ? paths.filter(isSpecPath) : [];
  const changeByPath = new Map(changes.map((item) => [item.path, item]));
  const reviewed = useToggleReviewed(scope, context, (notice) =>
    toast.add(notice),
  );
  const [discard, setDiscard] = useState<{
    path: string;
    nonce: number;
  } | null>(null);
  const renderChange = (path: string) => (
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
          (thread) => anchorPath(thread.anchor) === path && !thread.resolved,
        ).length
      }
      active={activeEntry === entryKey({ kind: 'change', path })}
      onOpen={onOpen}
      canReview={
        changeByPath.get(path)?.fingerprint !== null &&
        changeByPath.get(path)?.fingerprint !== undefined
      }
      onReview={() =>
        reviewed.toggle({
          path,
          reviewed: changeByPath.get(path)?.reviewStatus === 'reviewed',
          fingerprint: changeByPath.get(path)?.fingerprint,
        })
      }
      onDiscard={() =>
        setDiscard((current) => ({
          path,
          nonce: (current?.nonce ?? 0) + 1,
        }))
      }
    />
  );
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="p-2">
        {review ? (
          <WalkthroughRows
            scope={scope}
            context={context}
            review={review}
            activeEntry={activeEntry}
            onOpen={onOpen}
            files={paths.length}
          />
        ) : (
          <button
            type="button"
            className={ROW}
            aria-pressed={activeEntry === 'handoff'}
            onClick={() => onOpen({ kind: 'handoff' })}
          >
            All changes
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
        {mainPaths.map(renderChange)}
        {specPaths.length > 0 && (
          <details
            key={String(preferences.collapseSpecs)}
            open={!preferences.collapseSpecs}
            className="mt-3 border-t pt-2"
          >
            <summary className="cursor-pointer px-2 py-2 text-xs font-medium">
              Specs · {specPaths.length} files
            </summary>
            <button
              type="button"
              className={ROW}
              aria-pressed={activeEntry === 'specs'}
              onClick={() => onOpen(SPECS)}
            >
              Open all specs
            </button>
            {specPaths.map(renderChange)}
          </details>
        )}
        {discard && (
          <DiscardButton
            scope={scope}
            context={context}
            path={discard.path}
            signal={discard.nonce}
            hiddenTrigger
          />
        )}
      </div>
    </ScrollArea>
  );
}

function WalkthroughRows({
  scope,
  context,
  review,
  activeEntry,
  onOpen,
  files,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  review: ReviewResponse;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
  files: number;
}) {
  const walk = useWalkthrough(scope, context, review);
  const open = (key: WalkthroughKey) => {
    walk.go(key);
    onOpen({ kind: 'handoff' });
  };
  const here = (key: WalkthroughKey) =>
    activeEntry === 'handoff' && walk.stop.key === key;
  return (
    <nav aria-label="Walkthrough" className="flex flex-col">
      {walk.stops.map((stop) => {
        const progress = filesReviewed(stop.paths, walk.items);
        const done = walk.done(stop);
        const state =
          stop.kind === 'decision'
            ? walk.decisions.states.get(stop.layer.id)
            : undefined;
        return (
          <button
            key={stop.key}
            type="button"
            className={ROW}
            aria-pressed={here(stop.key)}
            onClick={() => open(stop.key)}
          >
            {stop.kind === 'briefing' ? (
              <CompassIcon className="size-3.5 shrink-0 text-muted-foreground" />
            ) : stop.kind === 'decision' ? (
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full text-2xs text-muted-foreground tabular-nums',
                  done && 'bg-graph-2 text-background',
                )}
              >
                {done ? (
                  <CheckIcon className="size-3" aria-label="Reviewed" />
                ) : (
                  stop.number
                )}
              </span>
            ) : stop.kind === 'unexplained' ? (
              <FileQuestionIcon className="size-3.5 shrink-0 text-graph-4" />
            ) : (
              <FlaskConicalIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {stopName(stop)}
              {stop.kind === 'unexplained' &&
                ` · ${notExplainedLabel(review.notExplained) ?? `${stop.paths.length} files`}`}
            </span>
            {state?.stale && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-graph-4"
                aria-label="Code moved"
              />
            )}
            {stop.kind !== 'briefing' && progress.total > 0 && (
              <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                {progress.reviewed}/{progress.total}
              </span>
            )}
          </button>
        );
      })}
      <ProofRow
        review={review}
        active={activeEntry === entryKey(PROOF)}
        onOpen={onOpen}
      />
      <button
        type="button"
        className={ROW}
        aria-pressed={activeEntry === 'all-changes'}
        onClick={() => onOpen(ALL_CHANGES)}
      >
        <FileDiffIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          All changes · {files} files
        </span>
      </button>
    </nav>
  );
}

function ProofRow({
  review,
  active,
  onOpen,
}: {
  review: ReviewResponse;
  active: boolean;
  onOpen: OpenDocument;
}) {
  const status = proofStatus(review.proof);
  return (
    <button
      type="button"
      className={ROW}
      aria-pressed={active}
      onClick={() => onOpen(PROOF)}
    >
      <FlaskConicalIcon
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground',
          status.failing > 0 && 'text-destructive',
        )}
      />
      <span className="min-w-0 truncate">
        Proof
        <span
          className={cn(
            'text-muted-foreground',
            status.failing > 0 && 'font-medium text-destructive',
          )}
        >
          {' · '}
          {proofLabel(status)}
        </span>
      </span>
    </button>
  );
}

function ChangeComment({
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

function BranchChangeComment({
  scope,
  context,
  base,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
}) {
  const { connection } = context;
  const changes = useBranchChanges(scope, connection, base);
  const branch = Option.getOrUndefined(AsyncResult.value(changes.result));
  const ref = branch?.base?.ref;
  const tip = branch?.head.oid;
  return (
    <ChangeComment
      scope={scope}
      context={context}
      anchor={
        ref === null || ref === undefined || tip === null || tip === undefined
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
  context: ConnectionContext;
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
  const markSeen = useMarkCommentsSeen(scope, context);
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
        : anchor.revision !== null && anchor.revision !== undefined
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
