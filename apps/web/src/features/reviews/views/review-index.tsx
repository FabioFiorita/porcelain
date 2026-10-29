import { PullRequestBlock } from './pull-request-block';
import { ReviewNavigation } from './review-navigation';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { toast } from '@/components/ui/toast';
import { DiscardButton } from '@/features/git-actions/index';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type ChangeScope } from '@/shared/workspace/search';
import { SegmentedTabs } from './segmented-tabs';
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { SidebarGroup, SidebarDocumentRow } from './sidebar-section';
import { useToggleReviewed } from '../commands/reviewed';
import { useComments, usePrefetchComments } from '../queries/comments';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  anchorPath,
  changeAnchor,
  type CommentThread,
  type FileCommentAnchor,
  threadCounts,
} from '@porcelain/client/reviews/rules';
import {
  SPECS,
  BRANCH,
  type DocumentRef,
  entryKey,
  type OpenDocument,
} from '../rules/documents';
import type { ReadinessKey } from '@porcelain/client/reviews/rules';
import {
  type ChangeList,
  type ReviewChangeItem,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { useReviewRevisionSelection, useWalkthroughPlace } from '../store';
import { BranchIndex } from './branch-index';
import { ChangeRow } from './change-row';
import { BranchReadiness, ChangeReadiness } from './readiness-panel';
import {
  ChangeComment,
  CommentsView,
  ReviewViews,
  WholeChangeComment,
} from './comments-view';
import { isSpecPath } from '@porcelain/client/reviews/rules';
import { useSpecsApart } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Props = {
  scope: ReviewScope;
  context: ConnectionContext;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
  sideLabel: string;
};
const CHANGE_SCOPES: readonly { value: ChangeScope; label: string }[] = [
  { value: 'uncommitted', label: 'Uncommitted' },
  { value: 'branch', label: 'Branch' },
];

type ScopeProps = {
  actionsTarget: HTMLElement | null;
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
  actionsTarget,
}: Props & ScopeProps) {
  const { connection } = context;
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  const [composing, setComposing] = useState(false);
  usePrefetchReviewed(scope, context);
  usePrefetchComments(scope, context);
  const list = useChanges(scope, connection);
  const published = usePublishedReview(scope, context);
  const review = published.review ?? null;
  const { setPlace } = useWalkthroughPlace(
    `${review?.reviewId ?? scope.worktreeId}:${review?.revision ?? ''}`,
  );
  const selection = useReviewRevisionSelection(review?.reviewId ?? '');
  const { threads } = useComments(scope, context);
  const changes = useReviewChangeItems(scope, context, list);
  const openComments = threadCounts(threads).open;

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
    if (key === 'checks') {
      selection.choose(undefined);
      setPlace('briefing');
      onOpen({ kind: 'handoff' });
    }
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
      {review?.reviewId && (
        <PullRequestBlock reviewId={review.reviewId} context={context} />
      )}
      <WholeChangeComment
        target={view === 'layers' ? actionsTarget : null}
        branch={branch}
        onCompose={() => {
          setView('comments');
          setComposing(true);
        }}
      />
      <SegmentedTabs
        label="Changes to review"
        className="px-2.5 pt-3"
        value={changeScope}
        onValue={(next) => {
          setComposing(false);
          onChangeScope(next);
        }}
        options={CHANGE_SCOPES}
      />
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
          context={context}
          files={changes}
          review={review}
          threads={threads}
          onSelect={selectReadiness}
        />
      )}
      <ReviewViews
        view={view}
        onView={(next) => {
          setComposing(false);
          setView(next);
        }}
        filesLabel={review && !branch ? 'Explore' : 'Changed files'}
        openComments={openComments}
      />
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
          threads={threads}
          scope={scope}
          context={context}
          composer={
            branch ? (
              <BranchChangeComment
                scope={scope}
                context={context}
                base={base}
                open={composing}
                setOpen={setComposing}
              />
            ) : (
              <ChangeComment
                scope={scope}
                context={context}
                anchor={changeAnchor(undefined)}
                open={composing}
                setOpen={setComposing}
              />
            )
          }
          onReveal={(anchor) => {
            if (anchor.kind === 'change') {
              onOpen(
                anchor.comparison?.kind === 'branch'
                  ? BRANCH
                  : { kind: 'handoff' },
                anchor,
              );
              return;
            }
            onOpen(
              anchorDocument(
                anchor,
                new Set(list.changes.map((entry) => entry.path)),
              ),
              anchor,
            );
          }}
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
  const specsApart = useSpecsApart(context.connection);
  const [groups, setGroups] = useState({ changes: true, specs: false });
  const paths = list.changes.map((entry) => entry.path);
  const mainPaths = specsApart
    ? paths.filter((path) => !isSpecPath(path))
    : paths;
  const specPaths = specsApart ? paths.filter(isSpecPath) : [];
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
      <div className="px-2.5 pt-2 pb-3">
        {review ? (
          <ReviewNavigation
            context={context}
            review={review}
            activeEntry={activeEntry}
            onOpen={onOpen}
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
        {!review && paths.length === 0 && (
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

function BranchChangeComment({
  scope,
  context,
  base,
  open,
  setOpen,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
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
      open={open}
      setOpen={setOpen}
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
