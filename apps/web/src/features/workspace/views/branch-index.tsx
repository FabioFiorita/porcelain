import { TruncatedText } from '@/shared/views/truncated-text';
import { BranchState } from './branch-state';
import type { AsyncResult } from 'effect/reactivity';
import { GitBranchIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { refLabel } from '@porcelain/client/history/rules';
import type { useBranchChanges } from '@/features/changes/index';
import { toast } from '@/components/ui/toast';
import { useToggleReviewed } from '../commands/reviewed';
import { useReviewedMarks } from '../queries/reviewed';
import {
  counted,
  anchorPath,
  type CommentThread,
} from '@porcelain/client/reviews/rules';
import { BRANCH, entryKey, type OpenDocument } from '../rules/documents';
import {
  mergeBranchChanges,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { branchReviewRange } from '@porcelain/client/reviews/rules';
import { BranchBasePicker } from './branch-base-picker';
import { branchChangeStatus } from '@porcelain/client/files/rules';
import { SidebarDocumentRow } from './sidebar-section';
import { ChangeRow } from './change-row';
import { groupSpecPaths } from '@porcelain/client/reviews/rules';
import { useSpecsApart } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';
import type { ComponentType, ReactNode } from 'react';
import type { BranchChangeItem } from '@porcelain/client/reviews/rules';

export type BranchFileGrouping = ComponentType<{
  scope: ReviewScope;
  context: ConnectionContext;
  items: readonly BranchChangeItem[];
  row: (item: BranchChangeItem) => ReactNode;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
}>;

export function BranchIndex({
  scope,
  context,
  base,
  activeEntry,
  threads,
  onOpen,
  sideLabel,
  onBase,
  grouping,
}: {
  grouping?: BranchFileGrouping | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
  sideLabel: string;
  onBase: (base: string | undefined) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <BranchBasePicker
          scope={scope}
          connection={context.connection}
          base={base}
          onBase={onBase}
        />
      </div>
      <BranchFiles
        scope={scope}
        context={context}
        base={base}
        activeEntry={activeEntry}
        threads={threads}
        onOpen={onOpen}
        sideLabel={sideLabel}
        grouping={grouping}
      />
    </div>
  );
}

function BranchFiles({
  scope,
  context,
  base,
  activeEntry,
  threads,
  onOpen,
  sideLabel,
  grouping,
}: {
  grouping: BranchFileGrouping | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
  sideLabel: string;
}) {
  return (
    <BranchState scope={scope} context={context} base={base}>
      {(branch) => (
        <BranchFileList
          scope={scope}
          context={context}
          branch={branch}
          activeEntry={activeEntry}
          threads={threads}
          onOpen={onOpen}
          sideLabel={sideLabel}
          grouping={grouping}
        />
      )}
    </BranchState>
  );
}

function BranchFileList({
  scope,
  context,
  branch,
  activeEntry,
  threads,
  onOpen,
  sideLabel,
  grouping: Grouping,
}: {
  grouping: BranchFileGrouping | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  branch: AsyncResult.AsyncResult.Success<
    ReturnType<typeof useBranchChanges>['result']
  >;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
  sideLabel: string;
}) {
  const specsApart = useSpecsApart(context.connection);
  const range = branchReviewRange(branch);
  const marks = useReviewedMarks(scope, context, range);
  const reviewed = useToggleReviewed(
    scope,
    context,
    (notice) => toast.add(notice),
    range,
  );
  if (branch.base === null || branch.base === undefined) return null;
  const items = mergeBranchChanges(branch.files, marks);
  const head =
    branch.head.branch === null || branch.head.branch === undefined
      ? 'this commit'
      : refLabel(branch.head.branch);
  const commits = counted(branch.commits, 'commit');
  const allLabel = Grouping ? 'All changes' : 'All branch changes';
  const row = (item: BranchChangeItem) => (
    <ChangeRow
      key={item.path}
      path={item.path}
      document={{ kind: 'branch-file', path: item.path }}
      note={item.status}
      changeStatus={branchChangeStatus(item)}
      scopes={[item.status]}
      reviewStatus={item.reviewStatus}
      commentCount={
        threads.filter(
          (thread) =>
            thread.anchor.comparison?.kind === 'branch' &&
            anchorPath(thread.anchor) === item.path &&
            !thread.resolved,
        ).length
      }
      active={
        activeEntry === entryKey({ kind: 'branch-file', path: item.path })
      }
      onOpen={onOpen}
      sideLabel={sideLabel}
      canReview={item.fingerprint !== null && item.fingerprint !== undefined}
      onReview={() =>
        reviewed.toggle({
          path: item.path,
          reviewed: item.reviewStatus === 'reviewed',
          fingerprint: item.fingerprint,
        })
      }
    />
  );
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="p-2 pr-3">
        <p className="px-2 pb-1.5 text-2xs text-muted-foreground">
          {commits} on {head} since {refLabel(branch.base.ref)}
        </p>
        <SidebarDocumentRow
          label={allLabel}
          active={activeEntry === entryKey(BRANCH)}
          onOpen={() => onOpen(BRANCH)}
          plain={Grouping !== undefined}
        >
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <TruncatedText className="min-w-0 flex-1" text={allLabel} />
          <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </SidebarDocumentRow>
        {items.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No changes since {refLabel(branch.base.ref)}
          </p>
        )}
        {Grouping ? (
          <Grouping
            scope={scope}
            context={context}
            items={items}
            row={row}
            activeEntry={activeEntry}
            onOpen={onOpen}
          />
        ) : (
          groupSpecPaths(items, specsApart).map(row)
        )}
      </div>
    </ScrollArea>
  );
}
