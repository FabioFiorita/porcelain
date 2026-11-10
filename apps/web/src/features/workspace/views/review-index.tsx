import type { ReviewStatus } from '@porcelain/client/reviews/rules';
import type { ComponentType, ReactNode } from 'react';
import { PullRequestBlock } from './pull-request-block';

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
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ReviewResponse } from '@porcelain/client/reviews/rules';

import { type BranchFileGrouping, BranchIndex } from './branch-index';
import { ChangeRow } from './change-row';
import { worktreeChangeMarks } from '@porcelain/client/files/rules';

import {
  ChangeComment,
  CommentsView,
  ReviewViews,
  WholeChangeComment,
} from './comments-view';
import { isSpecPath } from '@porcelain/client/reviews/rules';
import { useSpecsApart } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type WorkspaceChangesProps = {
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
  allChanges: DocumentRef;
  actionsTarget: HTMLElement | null;
  changeScope: ChangeScope;
  base: string | undefined;
  onChangeScope: (scope: ChangeScope) => void;
  onBase: (base: string | undefined) => void;
};

export type ReviewIndexProps = WorkspaceChangesProps & ScopeProps;

type ReviewContentProps = {
  reviewNavigation: ComponentType<{
    review: ReviewResponse;
    context: ConnectionContext;
    onOpen: OpenDocument;
    activeEntry: string | undefined;
  }>;
  branchReadiness: ComponentType<{
    scope: ReviewScope;
    context: ConnectionContext;
    base: string | undefined;
    review: ReviewResponse | null;
    threads: readonly CommentThread[];
    onSelect: (key: ReadinessKey, firstStale: string | undefined) => void;
  }>;
  changeReadiness: ComponentType<{
    context: ConnectionContext;
    files: readonly {
      path: string;
      reviewStatus: ReviewStatus;
    }[];
    review: ReviewResponse | null;
    threads: readonly CommentThread[];
    onSelect: (key: ReadinessKey, firstStale: string | undefined) => void;
  }>;
  onReviewReadiness: (key: 'checks' | 'unexplained') => void;
};

export type UncommittedFileGrouping = ComponentType<{
  scope: ReviewScope;
  context: ConnectionContext;
  paths: readonly string[];
  row: (path: string) => ReactNode;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
}>;

export type ChangeGrouping = {
  branch: BranchFileGrouping;
  uncommitted: UncommittedFileGrouping;
};

type IndexContent =
  | (ReviewContentProps & { grouping?: never })
  | ({ grouping: ChangeGrouping } & {
      [Key in keyof ReviewContentProps]?: never;
    });

export function ReviewIndex({
  reviewNavigation: ReviewNavigation,
  branchReadiness: BranchReadiness,
  changeReadiness: ChangeReadiness,
  onReviewReadiness,
  grouping,
  scope,
  context,
  activeEntry,
  onOpen,
  sideLabel,
  changeScope,
  base,
  onChangeScope,
  onBase,
  allChanges,
  actionsTarget,
}: ReviewIndexProps & IndexContent) {
  const { connection } = context;
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  const [composing, setComposing] = useState(false);
  usePrefetchReviewed(scope, context);
  usePrefetchComments(scope, context);
  const list = useChanges(scope, connection);
  const published = usePublishedReview(scope, context);
  const review = grouping ? null : (published.review ?? null);
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
    if (key === 'checks' || key === 'unexplained') {
      onReviewReadiness?.(key);
      onOpen({ kind: 'handoff' });
    }
    if (key === 'files') onOpen(branch ? BRANCH : allChanges);
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
        <PullRequestBlock
          reviewId={review.reviewId}
          context={context}
          onOpenPullRequest={(number) =>
            review.reviewId &&
            onOpen({ kind: 'pull-request', reviewId: review.reviewId, number })
          }
        />
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
      {BranchReadiness && branch && (
        <BranchReadiness
          scope={scope}
          context={context}
          base={base}
          review={review}
          threads={threads}
          onSelect={selectReadiness}
        />
      )}
      {ChangeReadiness && !branch && (
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
          grouping={grouping?.branch}
        />
      )}
      {view === 'layers' && !branch && (
        <LayersView
          reviewNavigation={ReviewNavigation}
          scope={scope}
          context={context}
          activeEntry={activeEntry}
          onOpen={onOpen}
          sideLabel={sideLabel}
          list={list}
          review={review}
          changes={changes}
          threads={threads}
          grouping={grouping?.uncommitted}
          allChanges={allChanges}
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
                anchor.comparison?.kind === 'branch' ? BRANCH : allChanges,
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
  reviewNavigation: ReviewNavigation,
  scope,
  context,
  activeEntry,
  onOpen,
  sideLabel,
  list,
  review,
  changes,
  threads,
  grouping: Grouping,
  allChanges,
}: WorkspaceChangesProps & {
  allChanges: DocumentRef;
  grouping: UncommittedFileGrouping | undefined;
  reviewNavigation: ReviewContentProps['reviewNavigation'] | undefined;
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
  const changeMarks = worktreeChangeMarks(list.changes);
  const reviewed = useToggleReviewed(scope, context, (notice) =>
    toast.add(notice),
  );
  const [discard, setDiscard] = useState<{
    path: string;
    nonce: number;
  } | null>(null);
  const navigation = () => {
    if (Grouping)
      return (
        <Grouping
          scope={scope}
          context={context}
          paths={paths}
          row={renderChange}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      );
    if (review && ReviewNavigation)
      return (
        <ReviewNavigation
          context={context}
          review={review}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      );
    return (
      <SidebarDocumentRow
        label="All changes"
        active={activeEntry === entryKey(allChanges)}
        onOpen={() => onOpen(allChanges)}
      >
        All changes
      </SidebarDocumentRow>
    );
  };
  const renderChange = (path: string) => (
    <ChangeRow
      key={path}
      path={path}
      document={{ kind: 'change', path }}
      note={undefined}
      changeStatus={changeMarks.files.get(path)}
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
        {navigation()}
        {!Grouping && !review && paths.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No changes</p>
        )}
        {!Grouping && mainPaths.length > 0 && (
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
        {!Grouping && specPaths.length > 0 && (
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
