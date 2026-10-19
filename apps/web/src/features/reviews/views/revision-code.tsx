import { reviewedControlLabel } from '@porcelain/client/reviews/rules';
import { useState } from 'react';
import { useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readReviewRevisionDiffs,
  readReviewRevisionFile,
  reviewCommands,
} from '@porcelain/client/reviews';
import type { ReviewMarks } from '@porcelain/client/reviews/rules';
import type {
  ReviewRevision,
  ReviewScope,
  ReviewStep,
} from '@porcelain/client/reviews/rules';
import { commitEntry } from '@/features/changes/index';
import { diffUnavailableReason } from '@porcelain/client/changes/rules';
import { Button } from '@/components/ui/button';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { CodeDocument } from './code-document';
import { fileEntry } from '../adapters/code-entries';
import { decisionNotes, gapNotes, mergeNotes } from '../rules/code-notes';
import { AgentNote } from './agent-note';

export function RevisionCode({
  revision,
  paths,
  scope,
  context,
  marks,
  steps = [],
}: {
  revision: ReviewRevision;
  paths: readonly string[];
  scope: ReviewScope;
  context: ConnectionContext;
  marks: ReviewMarks;
  steps?: readonly ReviewStep[];
}) {
  const [shown, setShown] = useState(DIFF_WINDOW_FILES);
  const files = revision.files.filter((file) => paths.includes(file.path));
  const reached = files.slice(0, shown);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {reached.length > 0 && (
        <RevisionDiffs
          revision={revision}
          files={reached}
          scope={scope}
          context={context}
          marks={marks}
        />
      )}
      {files.length > shown && (
        <Button
          variant="outline"
          className="m-3 self-start"
          onClick={() => setShown(shown + DIFF_WINDOW_FILES)}
        >
          Read more files
        </Button>
      )}
      {steps
        .filter(
          (step) => !files.some((file) => file.path === step.pointer.path),
        )
        .map((step) => (
          <RevisionFile
            key={step.id}
            revision={revision}
            scope={scope}
            context={context}
            path={step.pointer.path}
            step={step}
          />
        ))}
    </div>
  );
}

function RevisionDiffs({
  revision,
  files,
  scope,
  context,
  marks,
}: {
  revision: ReviewRevision;
  files: ReviewRevision['files'];
  scope: ReviewScope;
  context: ConnectionContext;
  marks: ReviewMarks;
}) {
  const result = useAtomValue(
    readReviewRevisionDiffs({
      connection: context.connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
      paths: files.map((file) => [
        ...new Set(
          [file.oldPath, file.newPath, file.path].filter(
            (path) => path !== undefined,
          ),
        ),
      ]),
    }),
  );
  const diffs = Option.getOrUndefined(AsyncResult.value(result));
  const notes = mergeNotes(
    ...revision.content.layers.map((layer, index) =>
      decisionNotes(layer, index + 1),
    ),
    gapNotes(revision.content.notExplained),
  );
  const commands = reviewCommands({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const [markResult, mark] = useAtom(commands.mark);
  const [unmarkResult, unmark] = useAtom(commands.unmark);
  const entries = files.flatMap((file) => {
    const diff = diffs?.diffs.find((item) => item.paths.includes(file.path));
    const entry = commitEntry(
      revision.headOid,
      {
        ...file,
        oldPath:
          file.oldPath ?? (file.status === 'added' ? undefined : file.path),
        newPath:
          file.newPath ?? (file.status === 'deleted' ? undefined : file.path),
      },
      diff?.content,
    );
    if (!entry) return [];
    const fingerprint = file.newOid ?? file.oldOid ?? null;
    const reviewed = marks.files.some(
      (item) => item.path === file.path && item.fingerprint === fingerprint,
    );
    return [
      {
        ...entry,
        agentNotes: notes[file.path] ?? [],
        comment: {
          filePath: file.path,
          revision: revision.headOid,
          comparison: {
            kind: 'branch' as const,
            base: revision.base,
          },
        },
        review: {
          path: file.path,
          fingerprint,
          reviewed,
          control: (
            <Button
              size="xs"
              variant="outline"
              aria-pressed={reviewed}
              aria-label={reviewedControlLabel(
                file.path,
                reviewed ? 'reviewed' : 'unreviewed',
              )}
              disabled={
                !fingerprint || markResult.waiting || unmarkResult.waiting
              }
              onClick={() =>
                fingerprint &&
                (reviewed
                  ? unmark({
                      kind: 'file',
                      path: file.path,
                      headBlobOid: fingerprint,
                    })
                  : mark({
                      kind: 'file',
                      revision: revision.revision,
                      path: file.path,
                      headBlobOid: fingerprint,
                    }))
              }
            >
              {reviewed ? 'File reviewed' : 'Mark file reviewed'}
            </Button>
          ),
        },
      },
    ];
  });
  return (
    <>
      {AsyncResult.isInitial(result) && (
        <p role="status" className="p-4">
          Loading revision code…
        </p>
      )}
      {AsyncResult.isFailure(result) && (
        <p role="alert" className="p-4 text-destructive">
          Revision code could not be read. The published explanations are still
          available.
        </p>
      )}
      {(AsyncResult.isFailure(markResult) ||
        AsyncResult.isFailure(unmarkResult)) && (
        <p role="alert" className="p-3 text-destructive">
          The file mark could not be updated. Try again.
        </p>
      )}
      {entries.length > 0 && (
        <CodeDocument
          scope={scope}
          context={context}
          interaction={{
            active: true,
            worktreeId: revision.reviewId,
            entry: `revision:${revision.revision}`,
          }}
          entries={entries}
          fullHeight
          onReview={(entry) => {
            const target = entry.review;
            if (
              !target?.fingerprint ||
              markResult.waiting ||
              unmarkResult.waiting
            )
              return;
            if (target.reviewed)
              unmark({
                kind: 'file',
                path: target.path,
                headBlobOid: target.fingerprint,
              });
            else
              mark({
                kind: 'file',
                revision: revision.revision,
                path: target.path,
                headBlobOid: target.fingerprint,
              });
          }}
        />
      )}
      {diffs &&
        files
          .filter((file) => !entries.some((entry) => entry.path === file.path))
          .map((file) => {
            const content = diffs.diffs.find((item) =>
              item.paths.includes(file.path),
            )?.content;
            return (
              <p key={file.path} className="p-3 text-sm break-all">
                {file.path} ·{' '}
                {content
                  ? diffUnavailableReason(file, content, false)
                  : 'Diff unavailable'}
              </p>
            );
          })}
    </>
  );
}

export function RevisionFile({
  revision,
  scope,
  context,
  path,
  step,
}: {
  revision: ReviewRevision;
  scope: ReviewScope;
  context: ConnectionContext;
  path: string;
  step?: ReviewStep;
}) {
  const result = useAtomValue(
    readReviewRevisionFile({
      connection: context.connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
      path,
    }),
  );
  const file = Option.getOrUndefined(AsyncResult.value(result));
  const entry =
    file?.kind === 'text'
      ? {
          ...fileEntry(
            `review:${revision.reviewId}:${revision.revision}:${path}`,
            path,
            file.text,
          ),
          comment: {
            filePath: path,
            revision: revision.headOid,
            comparison: { kind: 'file' as const },
          },
        }
      : undefined;
  return (
    <section
      aria-label={`File ${path}`}
      className="flex min-h-0 flex-col border-t"
    >
      {step && <AgentNote title={step.title} text={step.text} />}
      {entry ? (
        <CodeDocument
          scope={scope}
          context={context}
          interaction={{
            active: true,
            worktreeId: revision.reviewId,
            entry: `file:${revision.revision}:${path}`,
          }}
          entries={[entry]}
          fullHeight
        />
      ) : (
        <div className="p-4 text-sm break-all">
          <p>
            {path} ·{' '}
            {AsyncResult.isInitial(result)
              ? 'Loading code…'
              : 'Code unavailable at this revision'}
          </p>
          {step?.published && (
            <pre className="mt-2 overflow-auto whitespace-pre-wrap">
              {step.published.join('\n')}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
