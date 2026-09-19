import { CircleCheck } from 'lucide-react';
import { useMemo } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { entryKey, UNEXPLAINED } from '../../domain/documents';
import {
  fileProgress,
  notExplainedLabel,
  notExplainedSummary,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import { useMarks } from '../../query/marks';
import { useReview } from '../../query/review';
import { CodeDocument, CollapseAllButton } from './code-document';
import { MissingDocument, ProgressPill } from './document-parts';
import { DocumentToolbar } from './document-toolbar';
import type { DocumentProps } from './overview-document';
import { spansLabel } from './patch-focus';
import { useMarkActions } from './review-actions';
import { type ChangeRequest, useChangeEntries } from './use-change-entries';
import { useCollapsedFiles } from './use-collapsed-files';

/**
 * Changed lines no step of the review explains, file by file. Each diff is cut
 * down to those lines (with a little context) and its header names them. Binary
 * files (images) have no lines a step could point at, so they are always listed,
 * in their own section. The reviewer ticks these files one by one, as in plain
 * Changes, and can comment.
 */
export function UnexplainedDocument({ scope, active, reveal }: DocumentProps) {
  const review = useReview(scope);
  const marks = useMarks(scope);
  const threads = useComments(scope);
  const actions = useMarkActions(scope, marks);
  const collapse = useCollapsedFiles({
    worktreeId: scope.worktreeId,
    documentKey: entryKey(UNEXPLAINED),
  });
  const notExplained = review?.notExplained;
  const requests = useMemo<ChangeRequest[]>(
    () =>
      (notExplained ?? []).map((entry) =>
        entry.binary === true
          ? { path: entry.path }
          : entry.deleted === true || entry.ranges.length === 0
            ? { path: entry.path, note: 'Deleted' }
            : {
                path: entry.path,
                note: spansLabel(entry.ranges),
                focus: entry.ranges,
              },
      ),
    [notExplained],
  );
  const { entries, binaries } = useChangeEntries(scope, requests);

  if (review == null || notExplained == null) {
    return (
      <MissingDocument
        title="No review here"
        body="Not explained lists the code a review leaves out. This worktree has no review now."
      />
    );
  }

  const summary = notExplainedSummary(notExplained);
  const progress = fileProgress(
    notExplained.map((entry) => entry.path),
    marks,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title="Not explained"
        subtitle={
          notExplainedLabel(notExplained) ?? 'Every changed line is explained'
        }
      >
        {summary.files > 0 && (
          <ProgressPill {...progress} label="files reviewed" />
        )}
        <CollapseAllButton
          collapse={collapse}
          entries={entries}
          marks={marks}
          collapseReviewed
        />
      </DocumentToolbar>
      {summary.files === 0 ? (
        <div className="grid flex-1 place-items-center p-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <CircleCheck className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Nothing left out</EmptyTitle>
              <EmptyDescription>
                Every changed line belongs to a step of the review.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <CodeDocument
          hotkeysEnabled={active}
          scope={scope}
          entries={entries}
          binaries={binaries}
          threads={threads}
          commentable
          marks={marks}
          collapseReviewed
          collapse={collapse}
          onToggleReviewed={actions.toggleFile}
          reveal={reveal}
        />
      )}
    </div>
  );
}
