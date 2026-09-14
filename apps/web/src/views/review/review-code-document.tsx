import type { ReactNode } from 'react';
import type {
  Change,
  ReviewEvidence,
  ReviewScope,
  Status,
} from '../../domain/review';
import { changePath } from '../../domain/review';
import { useReviewEvidence } from '../../query/review';
import { CodeDocument, type CodeEntry } from './code-document';
import { diffEntry, evidenceId, fileEntry } from './diff-entries';

export function ReviewCodeDocument({
  scope,
  status,
  changes = status.changes,
  header,
}: {
  scope: ReviewScope;
  status: Status;
  changes?: readonly Change[];
  header?: () => ReactNode;
}) {
  const evidence = useReviewEvidence(scope, status.statusToken, changes);
  const unrenderableDiffs: Array<Extract<ReviewEvidence, { kind: 'omitted' }>> =
    [];
  const entries = evidence.flatMap((item): CodeEntry[] => {
    if (item.kind === 'file')
      return [
        fileEntry(
          evidenceId(item.change),
          item.change.path,
          item.text,
          'untracked',
        ),
      ];
    if (item.kind === 'diff') {
      const entry = diffEntry(item.change, item.response);
      if (!entry)
        unrenderableDiffs.push({
          kind: 'omitted',
          change: item.change,
          reason: 'No single-file textual patch',
        });
      return entry ? [entry] : [];
    }
    return [];
  });
  const omitted = [
    ...evidence.filter((item) => item.kind === 'omitted'),
    ...unrenderableDiffs,
  ];
  const documentHeader =
    header || omitted.length > 0
      ? () => (
          <>
            {header?.()}
            {omitted.length > 0 && <OmittedEvidence evidence={omitted} />}
          </>
        )
      : undefined;

  return (
    <CodeDocument
      entries={entries}
      {...(documentHeader ? { header: documentHeader } : {})}
    />
  );
}

function OmittedEvidence({
  evidence,
}: {
  evidence: ReadonlyArray<Extract<ReviewEvidence, { kind: 'omitted' }>>;
}) {
  return (
    <section className="mx-4 mt-3 rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium">Not shown in the code preview</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {evidence.map((item) => (
          <li key={evidenceId(item.change)} className="flex gap-2">
            <span className="min-w-0 flex-1 truncate">
              {changePath(item.change)}
            </span>
            <span>{item.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
