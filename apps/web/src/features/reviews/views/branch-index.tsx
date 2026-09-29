import { GitBranchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccessStore } from '@/features/access/index';
import {
  branchErrorMessage,
  branchName,
  useBranchChanges,
} from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { useReviewedMarks } from '../queries/reviewed';
import {
  anchorPath,
  type CommentAnchor,
  type CommentThread,
} from '../rules/comments';
import { BRANCH, type DocumentRef, entryKey } from '../rules/documents';
import { mergeBranchChanges, type ReviewScope } from '../rules/review';
import { branchReviewRange, type ReviewsContext } from '../rules/reviewed';
import { BranchBasePicker } from './branch-base-picker';
import { ChangeRow, ROW } from './change-row';
import { ReviewEmpty } from './review-empty';

type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;

export function BranchIndex({
  scope,
  context,
  base,
  activeEntry,
  threads,
  onOpen,
  onBase,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  base: string | undefined;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
  onBase: (base: string | undefined) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <BranchBasePicker scope={scope} base={base} onBase={onBase} />
      </div>
      <BranchFiles
        scope={scope}
        context={context}
        base={base}
        activeEntry={activeEntry}
        threads={threads}
        onOpen={onOpen}
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
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  base: string | undefined;
  activeEntry: string | undefined;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
}) {
  const connection = useAccessStore((state) => state.connection);
  const changes = useBranchChanges(scope, connection, base);
  const marks = useReviewedMarks(
    scope,
    context,
    branchReviewRange(changes.data?.base?.ref),
  );
  if (changes.isPending)
    return (
      <p role="status" className="p-3 text-xs text-muted-foreground">
        Comparing the branch…
      </p>
    );
  if (changes.isError)
    return (
      <div role="alert" className="p-3 text-xs text-muted-foreground">
        <span className="block">{branchErrorMessage(changes.error)}</span>
        <Button
          variant="outline"
          size="xs"
          className="mt-2"
          onClick={() => void changes.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  const branch = changes.data;
  if (branch.base == null)
    return (
      <div className="p-3">
        <ReviewEmpty
          title="No default branch"
          description="Choose the branch this one is compared against."
        />
      </div>
    );
  const items = mergeBranchChanges(branch.files, marks);
  const head =
    branch.head.branch == null ? 'this commit' : branchName(branch.head.branch);
  const commits = `${branch.commits} ${branch.commits === 1 ? 'commit' : 'commits'}`;
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="p-2">
        <p className="px-2 pb-1.5 text-[11.5px] text-muted-foreground">
          {commits} on {head} since {branchName(branch.base.ref)}
        </p>
        <button
          type="button"
          className={cn(ROW, activeEntry === entryKey(BRANCH) && 'bg-accent')}
          aria-pressed={activeEntry === entryKey(BRANCH)}
          onClick={() => onOpen(BRANCH)}
        >
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          All branch changes
          <span className="ml-auto text-[10.5px] text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </button>
        {items.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No changes since {branchName(branch.base.ref)}
          </p>
        )}
        {items.map((item) => (
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
          />
        ))}
      </div>
    </ScrollArea>
  );
}
