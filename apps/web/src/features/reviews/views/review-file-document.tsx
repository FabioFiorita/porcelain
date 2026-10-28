import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ArrowLeftIcon, HistoryIcon, ListChecksIcon } from 'lucide-react';
import {
  readReview,
  readReviewMarks,
  readReviewRevisionFile,
  readReviewRevisionDiffs,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  type ReviewRevision,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { quietButton } from './review-controls';
import { BarAction } from '@/shared/workspace/bar-action';
import type { ConnectionContext } from '@/shared/workspace/connection';
import {
  StateFailure,
  StateNotice,
  StateSkeleton,
} from '@/shared/views/state-notice';
import { TruncatedText } from '@/shared/views/truncated-text';
import { commitEntry } from '@/features/changes/index';
import { fileEntry } from '../adapters/code-entries';
import type {
  DocumentInteraction,
  DocumentRef,
  OpenDocument,
} from '../rules/documents';
import { retainedCommentTarget } from '../rules/retained-comments';
import { retainedDiffPaths, reviewFilePosition } from '../rules/review-file';
import { useWalkthroughPlace, useReviewFileOrigins } from '../store';
import { CodeDocument } from './code-document';
import { FileHeading } from './file-heading';

type ReviewFileRef = Extract<
  DocumentRef,
  { kind: 'review-file' | 'review-change' }
>;

export function ReviewFileDocument({
  document,
  context,
  interaction,
  onOpen,
}: {
  document: ReviewFileRef;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
}) {
  const query = readReview({
    connection: context.connection,
    reviewId: document.reviewId,
    revision: document.revision,
  });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const revision = Option.getOrUndefined(AsyncResult.value(result))?.revision;
  if (!revision) {
    if (AsyncResult.isFailure(result))
      return (
        <StateFailure
          description="The review file could not be read."
          onRetry={retry}
        />
      );
    if (AsyncResult.isInitial(result))
      return <StateSkeleton label="Loading review file" />;
    return (
      <StateNotice
        title="Revision not found"
        description="This retained file's revision is no longer available."
      />
    );
  }
  return (
    <RetainedFile
      document={document}
      revision={revision}
      context={context}
      interaction={interaction}
      onOpen={onOpen}
    />
  );
}

function RetainedFile({
  document,
  revision,
  context,
  interaction,
  onOpen,
}: {
  document: ReviewFileRef;
  revision: ReviewRevision;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
}) {
  const { path } = document;
  const scope: ReviewScope = {
    projectId: revision.projectId,
    worktreeId: revision.content.worktreeId,
    review: { reviewId: revision.reviewId, revision: revision.revision },
  };
  const input = {
    connection: context.connection,
    reviewId: revision.reviewId,
    revision: revision.revision,
  };
  const query = readReviewRevisionFile({ ...input, path });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const file = Option.getOrUndefined(AsyncResult.value(result));
  const changed = revision.files.find((file) => file.path === path);
  const diffQuery = readReviewRevisionDiffs({
    ...input,
    paths: changed ? [retainedDiffPaths(changed)] : [],
  });
  const diffs = useAtomValue(diffQuery);
  const retryDiff = useAtomRefresh(diffQuery);
  const codeFailed =
    document.kind === 'review-change'
      ? AsyncResult.isFailure(diffs)
      : AsyncResult.isFailure(result);
  const codePending =
    document.kind === 'review-change'
      ? AsyncResult.isInitial(diffs)
      : AsyncResult.isInitial(result);
  const retryCode = document.kind === 'review-change' ? retryDiff : retry;
  const diffEntry = changed
    ? commitEntry(
        revision.headOid,
        { ...changed, oldPath: changed.oldPath, newPath: changed.newPath },
        Option.getOrUndefined(AsyncResult.value(diffs))?.diffs[0]?.content,
      )
    : undefined;
  const diff = diffEntry?.fileDiff;
  const shownEntry = () => {
    if (document.kind === 'review-change') return diffEntry;
    if (file?.kind === 'text')
      return fileEntry(
        `review:${revision.reviewId}:${revision.revision}:${path}`,
        path,
        file.text,
      );
    return undefined;
  };
  const entry = shownEntry();
  const marks = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readReviewMarks(input))),
  );
  const commands = reviewCommands(input);
  const [markResult, mark] = useAtom(commands.mark, { mode: 'promise' });
  const [unmarkResult, unmark] = useAtom(commands.unmark, { mode: 'promise' });
  const fingerprint = changed?.newOid ?? changed?.oldOid;
  const reviewed =
    marks?.files.some(
      (item) => item.path === path && item.fingerprint === fingerprint,
    ) ?? false;
  const place = useWalkthroughPlace(
    `${revision.reviewId}:${revision.revision}`,
  );
  const layers = revision.content.layers;
  const origins = useReviewFileOrigins(revision.reviewId, revision.revision);
  const position = reviewFilePosition(
    layers,
    path,
    origins.steps[path],
    place.place,
  );
  const owner = position ? layers[position.decision] : undefined;
  const step = position ? owner?.steps[position.stop] : undefined;
  const excerpt = step?.published && (
    <pre className="overflow-auto whitespace-pre-wrap">
      {step.published.join('\n')}
    </pre>
  );
  const unavailable = () => {
    if (codeFailed)
      return (
        <>
          <StateFailure
            description={`${path} · Code unavailable at this revision`}
            onRetry={retryCode}
          />
          {excerpt}
        </>
      );
    if (codePending) return <StateSkeleton label="Loading retained file" />;
    if (file?.kind === 'too-large')
      return (
        <StateNotice
          title="Not shown"
          description="This file is too large to display."
        />
      );
    if (file?.kind === 'unsupported')
      return (
        <StateNotice
          title="Not shown"
          description="This file cannot be displayed as text."
        />
      );
    return (
      <StateNotice
        title="Not shown"
        description={`${path} · Code unavailable at this revision`}
      >
        {excerpt}
      </StateNotice>
    );
  };
  return (
    <article
      aria-label={step ? `Step ${step.title}` : `File ${path}`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        data-review-file-banner=""
        className="flex min-h-9 shrink-0 items-center gap-2 border-b bg-muted pr-2 pl-4 text-xs leading-4 text-muted-foreground"
      >
        <ListChecksIcon className="size-3.5 shrink-0" />
        <TruncatedText
          className="min-w-0 flex-1"
          text={
            owner && step
              ? `Part of the review · Decision ${layers.indexOf(owner) + 1}, stop ${owner.steps.indexOf(step) + 1} · ${step.title}`
              : 'Part of the review'
          }
        >
          Part of the review
          {owner && step && (
            <>
              {' '}
              · Decision {layers.indexOf(owner) + 1}, stop{' '}
              {owner.steps.indexOf(step) + 1} ·{' '}
              <span className="font-medium text-foreground">{step.title}</span>
            </>
          )}
        </TruncatedText>
        <button
          type="button"
          className={`${quietButton} h-6 gap-1.5 rounded-[--spacing(1.5)] px-2 text-xs leading-4 text-brand hover:underline`}
          onClick={() => onOpen({ kind: 'handoff' })}
        >
          <ArrowLeftIcon className="size-3" />
          Back to the walkthrough
        </button>
      </div>
      <FileHeading path={path} note={changed?.status} diff={diff} />
      {(AsyncResult.isFailure(markResult) ||
        AsyncResult.isFailure(unmarkResult)) && (
        <p role="alert" className="p-3 text-sm text-destructive">
          The file mark could not be updated. Try again.
        </p>
      )}
      {entry ? (
        <CodeDocument
          scope={scope}
          context={context}
          interaction={interaction}
          disableFileHeader
          compactThreads={document.kind === 'review-file'}
          fileDiff={document.kind === 'review-file' ? diff : undefined}
          headerActions={
            <BarAction
              label="Timeline"
              iconOnly
              icon={HistoryIcon}
              onClick={() => onOpen({ kind: 'timeline', path })}
            />
          }
          entries={[
            {
              ...entry,
              comment: retainedCommentTarget(revision, path),
              ...(fingerprint
                ? { review: { path, fingerprint, reviewed, control: null } }
                : {}),
            },
          ]}
          onReview={() => {
            if (!fingerprint || markResult.waiting || unmarkResult.waiting)
              return;
            if (reviewed)
              void unmark({ kind: 'file', path, headBlobOid: fingerprint });
            else
              void mark({
                kind: 'file',
                revision: revision.revision,
                path,
                headBlobOid: fingerprint,
              });
          }}
        />
      ) : (
        unavailable()
      )}
    </article>
  );
}
