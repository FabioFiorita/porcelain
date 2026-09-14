import type { ReactNode } from 'react';
import type {
  Change,
  Diff,
  ReviewEvidenceItem,
  ReviewScope,
} from '../../domain/review';
import { useReviewEvidence } from '../../query/review';
import { CodeDocument, type CodeEntry } from './code-document';
import { diffEntry, evidenceId, fileEntry } from './diff-entries';
import { MarkAllReviewed, ReviewedControl } from './reviewed-control';

export function ReviewCodeDocument({
  scope,
  changes,
  header,
  allowBulkReview = false,
}: {
  scope: ReviewScope;
  changes?: readonly Change[];
  header?: () => ReactNode;
  allowBulkReview?: boolean;
}) {
  // An omitted selection means the complete handoff. Selected views filter by
  // logical path, while the evidence query retains every comparison for that
  // path (including staged and unstaged changes).
  const evidence = useReviewEvidence(scope, changes);
  const unrenderable = evidence.flatMap((item) => {
    const reasons = item.comparisons.flatMap((comparison) => {
      if (comparison.content.kind === 'omitted')
        return [formatOmission(comparison.content.reason)];
      if (comparison.content.kind === 'file') return [];
      if (comparison.content.content.kind === 'binary')
        return ['Binary change'];
      if (comparison.content.content.kind === 'omitted')
        return [`Content omitted: ${comparison.content.content.reason}`];
      if (!('kind' in comparison.change)) return ['Unsupported comparison'];
      const response = toDiff(item, comparison.change, comparison.content);
      return diffEntry(comparison.change, response)
        ? []
        : ['No single-file textual patch'];
    });
    return reasons.length > 0 ? [{ item, reasons }] : [];
  });
  const entries = evidence.flatMap((item): CodeEntry[] =>
    item.comparisons.flatMap((comparison) => {
      const review = reviewControl(scope, item);
      if (comparison.content.kind === 'file')
        return [
          {
            ...fileEntry(
              evidenceId(comparison.change),
              item.path,
              comparison.content.text,
              `${comparison.change.scope} · untracked`,
            ),
            review,
          },
        ];
      if (comparison.content.kind !== 'diff') return [];
      if (!('kind' in comparison.change)) return [];
      const entry = diffEntry(
        comparison.change,
        toDiff(item, comparison.change, comparison.content),
      );
      return entry ? [{ ...entry, review }] : [];
    }),
  );
  const renderedPaths = new Set(entries.map((entry) => entry.path));
  const documentHeader =
    header || unrenderable.length > 0
      ? () => (
          <>
            {header?.()}
            {unrenderable.length > 0 && (
              <OmittedEvidence
                evidence={unrenderable}
                renderedPaths={renderedPaths}
                scope={scope}
              />
            )}
          </>
        )
      : undefined;

  return (
    <CodeDocument
      entries={entries}
      {...(documentHeader ? { header: documentHeader } : {})}
      {...(allowBulkReview
        ? {
            toolbar: () => (
              <div className="flex shrink-0 justify-end border-b px-4 py-2">
                <MarkAllReviewed scope={scope} entries={evidence} />
              </div>
            ),
          }
        : {})}
    />
  );
}

function reviewControl(scope: ReviewScope, item: ReviewEvidenceItem) {
  return {
    path: item.path,
    control: (
      <ReviewedControl
        key={`review:${item.path}`}
        scope={scope}
        path={item.path}
        fingerprint={item.fingerprint}
        status={item.reviewStatus}
        compact
      />
    ),
  };
}

function toDiff(
  item: ReviewEvidenceItem,
  change: Extract<Change, { kind: string }>,
  content: Extract<
    ReviewEvidenceItem['comparisons'][number]['content'],
    { kind: 'diff' }
  >,
): Diff {
  return {
    environmentId: item.environmentId,
    worktreeId: item.worktreeId,
    statusToken: item.statusToken,
    consistency: item.consistency,
    change: {
      scope: change.scope,
      oldPath: change.oldPath,
      newPath: change.newPath,
    },
    oldMode: change.oldMode,
    newMode: change.newMode,
    content: content.content,
  };
}

function formatOmission(reason: string) {
  return reason.replaceAll('-', ' ');
}

function OmittedEvidence({
  evidence,
  renderedPaths,
  scope,
}: {
  evidence: ReadonlyArray<{
    item: ReviewEvidenceItem;
    reasons: readonly string[];
  }>;
  renderedPaths: ReadonlySet<string>;
  scope: ReviewScope;
}) {
  return (
    <section className="mx-4 mt-3 rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium">Not shown in the code preview</p>
      <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
        {evidence.map(({ item, reasons }) => (
          <li key={item.path} className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{item.path}</span>
            <span className="shrink-0">{reasons.join(', ')}</span>
            {!renderedPaths.has(item.path) && (
              <ReviewedControl
                scope={scope}
                path={item.path}
                fingerprint={item.fingerprint}
                status={item.reviewStatus}
                compact
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
