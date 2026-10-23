import { TruncatedText } from '@/shared/views/truncated-text';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import { GitBranchIcon } from 'lucide-react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { branchErrorMessage } from '@porcelain/client/changes/rules';
import { refLabel } from '@porcelain/client/history/rules';
import { useBranchChanges } from '@/features/changes/index';
import { toast } from '@/components/ui/toast';
import { useToggleReviewed } from '../commands/reviewed';
import { useReviewedMarks } from '../queries/reviewed';
import {
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
import { SidebarDocumentRow } from './sidebar-section';
import { ChangeRow } from './change-row';
import { ReviewEmpty } from './review-empty';
import { groupSpecPaths } from '@porcelain/client/reviews/rules';
import { usePreferences } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function BranchIndex({
  scope,
  context,
  base,
  activeEntry,
  threads,
  onOpen,
  sideLabel,
  onBase,
}: {
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
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
  sideLabel: string;
}) {
  const { connection } = context;
  const changes = useBranchChanges(scope, connection, base);
  if (AsyncResult.isFailure(changes.result))
    return (
      <div role="alert" className="p-3 text-xs text-muted-foreground">
        <span className="block">
          {branchErrorMessage(
            AsyncResult.isFailure(changes.result)
              ? Cause.squash(changes.result.cause)
              : undefined,
          )}
        </span>
        <Button
          variant="outline"
          size="xs"
          className="mt-2"
          onClick={changes.refresh}
        >
          Try again
        </Button>
      </div>
    );
  if (!AsyncResult.isSuccess(changes.result)) return <ComparingBranch />;
  if (changes.result.value.base === undefined)
    return (
      <div className="p-3">
        <ReviewEmpty
          title="No default branch"
          description="Choose the branch this one is compared against."
        />
      </div>
    );
  return (
    <Suspense fallback={<ComparingBranch />}>
      <BranchFileList
        scope={scope}
        context={context}
        branch={changes.result.value}
        activeEntry={activeEntry}
        threads={threads}
        onOpen={onOpen}
        sideLabel={sideLabel}
      />
    </Suspense>
  );
}

function ComparingBranch() {
  return (
    <p role="status" className="p-3 text-xs text-muted-foreground">
      Comparing the branch…
    </p>
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
}: {
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
  const { preferences } = usePreferences();
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
  const commits = `${branch.commits} ${branch.commits === 1 ? 'commit' : 'commits'}`;
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="p-2 pr-3">
        <p className="px-2 pb-1.5 text-2xs text-muted-foreground">
          {commits} on {head} since {refLabel(branch.base.ref)}
        </p>
        <SidebarDocumentRow
          label="All branch changes"
          active={activeEntry === entryKey(BRANCH)}
          onOpen={() => onOpen(BRANCH)}
        >
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <TruncatedText
            className="min-w-0 flex-1"
            text={'All branch changes'}
          />
          <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </SidebarDocumentRow>
        {items.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No changes since {refLabel(branch.base.ref)}
          </p>
        )}
        {groupSpecPaths(items, preferences.collapseSpecs).map((item) => (
          <ChangeRow
            key={item.path}
            path={item.path}
            document={{ kind: 'branch-file', path: item.path }}
            note={item.status}
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
            canReview={
              item.fingerprint !== null && item.fingerprint !== undefined
            }
            onReview={() =>
              reviewed.toggle({
                path: item.path,
                reviewed: item.reviewStatus === 'reviewed',
                fingerprint: item.fingerprint,
              })
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}
