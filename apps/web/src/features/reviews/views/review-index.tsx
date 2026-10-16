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
import { useState } from 'react';
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
import { useVisibleComments } from '../commands/comments';
import { useAtom } from '@effect/atom-react';
import {
  completeDecision,
  decisionCompletionBinding,
} from '@porcelain/client/reviews';
import { SidebarActionMenu } from './sidebar-action-menu';
import { SidebarGroup, SidebarDocumentRow } from './sidebar-section';
import { reviewSidebarActions } from '@porcelain/client/reviews/rules';
import { useToggleReviewed } from '../commands/reviewed';
import { useComments, usePrefetchComments } from '../queries/comments';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  type CommentAnchor,
  anchorPath,
  changeAnchor,
  type CommentThread,
  type FileCommentAnchor,
} from '@porcelain/client/reviews/rules';
import {
  ALL_CHANGES,
  publishedReviewTitle,
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
  type WalkthroughStop,
  notExplainedLabel,
  type ReviewChangeItem,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { useWalkthroughPlace } from '../store';
import { BranchIndex } from './branch-index';
import { ChangeRow, ROW } from './change-row';
import { DeleteReview } from './delete-review';
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
  sideLabel: string;
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
  sideLabel,
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
  const review = published.review ?? null;
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
      {published.review && <DeleteReview scope={scope} context={context} />}
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
      {view === 'layers' && branch && (
        <BranchIndex
          scope={scope}
          context={context}
          base={base}
          activeEntry={activeEntry}
          threads={threads}
          onOpen={onOpen}
          sideLabel={sideLabel}
          onBase={onBase}
        />
      )}
      {view === 'layers' && !branch && (
        <LayersView
          scope={scope}
          context={context}
          activeEntry={activeEntry}
          onOpen={onOpen}
          sideLabel={sideLabel}
          list={list}
          review={review}
          changes={changes}
          threads={threads}
        />
      )}
      {view === 'comments' && (
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
  sideLabel,
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
  const [groups, setGroups] = useState({ changes: true, specs: false });
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
      sideLabel={sideLabel}
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
      <div className="p-2 pr-3">
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
          <SidebarDocumentRow
            label="All changes"
            active={activeEntry === 'handoff'}
            onOpen={() => onOpen({ kind: 'handoff' })}
          >
            All changes
          </SidebarDocumentRow>
        )}
        {paths.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No changes</p>
        )}
        {mainPaths.length > 0 && (
          <SidebarGroup
            name="Changed files"
            count={mainPaths.length}
            expanded={groups.changes}
            onExpanded={(changes) =>
              setGroups((current) => ({ ...current, changes }))
            }
            onAll={(expanded) =>
              setGroups({ changes: expanded, specs: expanded })
            }
          >
            {mainPaths.map(renderChange)}
          </SidebarGroup>
        )}
        {specPaths.length > 0 && (
          <SidebarGroup
            name="Specs"
            count={specPaths.length}
            expanded={groups.specs}
            onExpanded={(specs) =>
              setGroups((current) => ({ ...current, specs }))
            }
            onAll={(expanded) =>
              setGroups({ changes: expanded, specs: expanded })
            }
          >
            <SidebarDocumentRow
              label="Open all specs"
              active={activeEntry === 'specs'}
              onOpen={() => onOpen(SPECS)}
            >
              Open all specs
            </SidebarDocumentRow>
            {specPaths.map(renderChange)}
          </SidebarGroup>
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
  const completion = decisionCompletionBinding(
    useAtom(completeDecision({ scope, connection: context.connection }), {
      mode: 'promiseExit',
    }),
    (notice) => toast.add(notice),
  );
  const open = (key: WalkthroughKey) => {
    walk.go(key);
    onOpen({ kind: 'handoff' });
  };
  const here = (key: WalkthroughKey) =>
    activeEntry === 'handoff' && walk.stop.key === key;
  return (
    <nav aria-label="Walkthrough" className="flex flex-col">
      {!review.active && (
        <SidebarDocumentRow
          label="Saved review"
          active={here('briefing')}
          onOpen={() => open('briefing')}
        >
          {publishedReviewTitle(review)}
        </SidebarDocumentRow>
      )}
      {walk.stops.map((stop) => {
        const files = walk.items.filter((item) =>
          stop.paths.includes(item.path),
        );
        const progress = filesReviewed(stop.paths, walk.items);
        const done = walk.done(stop);
        const state =
          stop.kind === 'decision'
            ? walk.decisions.states.get(stop.layer.id)
            : undefined;
        return (
          <SidebarActionMenu
            key={stop.key}
            label={
              stop.kind === 'decision'
                ? `More actions for decision ${stop.number}`
                : `More actions for ${stopName(stop)}`
            }
            {...(stop.kind === 'decision'
              ? { description: stop.layer.title }
              : {})}
            actions={reviewSidebarActions(
              stop.kind === 'decision'
                ? {
                    kind: 'decision',
                    reviewed: done,
                    stale: state?.stale === true,
                    settled: walk.decisions.settled,
                    pending: completion.pending,
                    files,
                  }
                : { kind: 'section' },
            )}
            onAction={(id) => {
              if (id === 'open') open(stop.key);
              if (id === 'review' && stop.kind === 'decision') {
                const decision = {
                  layerId: stop.layer.id,
                  fingerprint: stop.layer.fingerprint,
                };
                if (done) completion.reopen(decision);
                else
                  completion.complete({
                    files,
                    decision: {
                      ...decision,
                      reviewed: state?.reviewed === true,
                    },
                  });
              }
            }}
          >
            {(menu) => (
              <div className="flex min-w-0 items-center">
                <button
                  type="button"
                  className={ROW}
                  aria-pressed={here(stop.key)}
                  onClick={() => open(stop.key)}
                >
                  <StopIcon stop={stop} done={done} />
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
                {menu}
              </div>
            )}
          </SidebarActionMenu>
        );
      })}
      <ProofRow
        review={review}
        active={activeEntry === entryKey(PROOF)}
        onOpen={onOpen}
      />
      <SidebarDocumentRow
        label="All changes"
        active={activeEntry === 'all-changes'}
        onOpen={() => onOpen(ALL_CHANGES)}
      >
        <FileDiffIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          All changes · {files} files
        </span>
      </SidebarDocumentRow>
    </nav>
  );
}

function StopIcon({ stop, done }: { stop: WalkthroughStop; done: boolean }) {
  if (stop.kind === 'briefing') {
    return <CompassIcon className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  if (stop.kind === 'decision') {
    return (
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
    );
  }
  if (stop.kind === 'unexplained') {
    return <FileQuestionIcon className="size-3.5 shrink-0 text-graph-4" />;
  }
  return (
    <FlaskConicalIcon className="size-3.5 shrink-0 text-muted-foreground" />
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
    <SidebarDocumentRow
      label="Proof"
      active={active}
      onOpen={() => onOpen(PROOF)}
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
    </SidebarDocumentRow>
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

function anchorDocument(
  anchor: FileCommentAnchor,
  changed: ReadonlySet<string>,
): DocumentRef {
  if (anchor.comparison?.kind === 'branch') {
    return { kind: 'branch-file', path: anchor.filePath };
  }
  if (anchor.revision !== null && anchor.revision !== undefined) {
    return { kind: 'commit', oid: anchor.revision };
  }
  if (anchor.comparison?.kind !== 'file' && changed.has(anchor.filePath)) {
    return { kind: 'change', path: anchor.filePath };
  }
  return { kind: 'file', path: anchor.filePath };
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

  useVisibleComments(scope, context, filter);

  const reveal = (anchor: CommentAnchor) => {
    if (anchor.kind === 'change') {
      onOpen(
        anchor.comparison?.kind === 'branch' ? BRANCH : { kind: 'handoff' },
        anchor,
      );
      return;
    }
    onOpen(anchorDocument(anchor, changed), anchor);
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
