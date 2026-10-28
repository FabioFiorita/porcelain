import { TruncatedText } from '@/shared/views/truncated-text';
import { CheckIcon, CircleAlertIcon, CircleXIcon } from 'lucide-react';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { readReview, readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionProgress,
  type ReviewMarks,
} from '@porcelain/client/reviews/rules';
import { Suspense, type ReactNode } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useSpecsApart } from '@/features/preferences/index';
import { useBranchChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { useReviewedMarks } from '../queries/reviewed';
import { ProgressMeter } from './progress-meter';
import type { CommentThread } from '@porcelain/client/reviews/rules';
import {
  type ReadinessItem,
  type ReadinessKey,
  readinessItems,
  type ReadinessTone,
} from '@porcelain/client/reviews/rules';
import {
  mergeBranchChanges,
  type ReviewResponse,
  type ReviewScope,
  type ReviewStatus,
} from '@porcelain/client/reviews/rules';
import { branchReviewRange } from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Select = (key: ReadinessKey, firstStale: string | undefined) => void;

export function ChangeReadiness({
  files,
  review,
  threads,
  onSelect,
  context,
  marks,
}: {
  context: ConnectionContext;
  marks?: ReviewMarks | undefined;
  files: readonly { path: string; reviewStatus: ReviewStatus }[];
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const items = readinessItems({ files, review, explains: true, threads });
  return (
    <ReadinessContent
      items={items}
      review={review}
      context={context}
      marks={marks}
      onSelect={(key) =>
        onSelect(key, files.find((file) => file.reviewStatus === 'stale')?.path)
      }
    />
  );
}

export function BranchReadiness({
  scope,
  context,
  base,
  review,
  threads,
  onSelect,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const { connection } = context;
  const changes = useBranchChanges(scope, connection, base);
  const branch = Option.getOrUndefined(AsyncResult.value(changes.result));
  if (branch?.base === null || branch?.base === undefined) return null;
  return (
    <Suspense fallback={null}>
      <BranchReadinessMarks
        scope={scope}
        context={context}
        branch={branch}
        review={review}
        threads={threads}
        onSelect={onSelect}
      />
    </Suspense>
  );
}

function BranchReadinessMarks({
  scope,
  context,
  branch,
  review,
  threads,
  onSelect,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  branch: AsyncResult.AsyncResult.Success<
    ReturnType<typeof useBranchChanges>['result']
  >;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const marks = useReviewedMarks(scope, context, branchReviewRange(branch));
  if (branch.base === null || branch.base === undefined) return null;
  const files = mergeBranchChanges(branch.files, marks);
  return (
    <ReadinessContent
      items={readinessItems({ files, review, explains: false, threads })}
      review={review}
      context={context}
      onSelect={(key) =>
        onSelect(key, files.find((file) => file.reviewStatus === 'stale')?.path)
      }
    />
  );
}

function ReadinessContent({
  items,
  review,
  context,
  marks,
  onSelect,
}: {
  items: readonly ReadinessItem[];
  review: ReviewResponse | null;
  context: ConnectionContext;
  marks?: ReviewMarks | undefined;
  onSelect: (key: ReadinessKey) => void;
}) {
  return (
    <ReadinessCard
      items={items}
      published={Boolean(review?.reviewId)}
      onSelect={onSelect}
    >
      {review?.reviewId && (
        <PublishedReadiness
          review={review}
          reviewId={review.reviewId}
          context={context}
          marks={marks}
          onSelect={onSelect}
        />
      )}
    </ReadinessCard>
  );
}

function PublishedReadiness({
  review,
  reviewId,
  context,
  marks,
  onSelect,
}: {
  review: ReviewResponse;
  reviewId: string;
  context: ConnectionContext;
  marks: ReviewMarks | undefined;
  onSelect: (key: ReadinessKey) => void;
}) {
  const { progress, failed, retry } = usePublishedProgress({
    review,
    reviewId,
    context,
    marks,
  });
  const unavailable = failed ? 'Unavailable · Try again' : 'Loading…';
  const decisionValue = progress
    ? `${progress.reviewed} of ${progress.total} reviewed`
    : unavailable;
  const proof = review.proof;
  const proven =
    proof.current &&
    proof.checks.length > 0 &&
    proof.checks.every((check) => check.result === 'pass');
  const incomplete = proof.current ? 'Incomplete' : 'Outdated';
  const provenAt = review.headOid?.slice(0, 7);
  const proofValue = proven
    ? `Proven at ${provenAt ?? 'published head'}`
    : incomplete;
  const incompleteLabel = proof.current
    ? 'Proof is incomplete'
    : 'Proof predates the latest changes';
  const proofLabel = proven ? proofValue : incompleteLabel;
  return (
    <>
      <ReadinessRow
        name="Proof"
        label={proofLabel}
        value={proven && provenAt ? 'Proven at' : proofValue}
        code={proven ? provenAt : undefined}
        tone={proven ? 'ok' : 'attention'}
        onSelect={() => onSelect('checks')}
      />
      <ReadinessRow
        name="Decisions"
        label={
          progress
            ? `${progress.reviewed} of ${progress.total} decisions reviewed`
            : `Decisions ${unavailable}`
        }
        value={decisionValue}
        tone={progress || !failed ? 'progress' : 'attention'}
        meter={
          progress && (
            <ProgressMeter
              label="Decisions reviewed"
              value={progress.reviewed}
              max={progress.total}
              className="w-14"
            />
          )
        }
        onSelect={failed ? retry : () => onSelect('files')}
      />
    </>
  );
}

type PublishedProgressInput = {
  review: ReviewResponse;
  reviewId: string;
  context: ConnectionContext;
  marks: ReviewMarks | undefined;
};

function usePublishedProgress({
  review,
  reviewId,
  context,
  marks,
}: PublishedProgressInput) {
  const query = readReview({
    connection: context.connection,
    reviewId,
    revision: review.revision,
  });
  const markQuery = readReviewMarks({
    connection: context.connection,
    reviewId,
  });
  const result = useAtomValue(query);
  const markResult = useAtomValue(markQuery);
  const refresh = useAtomRefresh(query);
  const refreshLatest = useAtomRefresh(
    readReview({ connection: context.connection, reviewId }),
  );
  const refreshMarks = useAtomRefresh(markQuery);
  const specsApart = useSpecsApart(context.connection);
  const snapshot = Option.getOrUndefined(AsyncResult.value(result))?.revision;
  const currentMarks =
    marks ?? Option.getOrUndefined(AsyncResult.value(markResult));
  const failed =
    AsyncResult.isFailure(result) ||
    (marks === undefined && AsyncResult.isFailure(markResult));
  return {
    progress:
      !failed && snapshot && currentMarks
        ? revisionDecisionProgress(snapshot, currentMarks, {
            specsApart,
          })
        : undefined,
    failed,
    retry: () => {
      refresh();
      refreshLatest();
      refreshMarks();
    },
  };
}

const names: Record<ReadinessKey, string> = {
  files: 'Files',
  stale: 'Code moved',
  unexplained: 'Explanation',
  comments: 'Comments',
  replies: 'Replies',
  checks: 'Checks',
};

function ReadinessCard({
  items,
  published,
  onSelect,
  children,
}: {
  items: readonly ReadinessItem[];
  published: boolean;
  onSelect: (key: ReadinessKey) => void;
  children?: ReactNode;
}) {
  const checks = items.filter((item) => item.key === 'checks');
  const comments = items.filter(
    (item) => item.key === 'comments' || item.key === 'replies',
  );
  const files = published
    ? []
    : items.filter(
        (item) => !checks.includes(item) && !comments.includes(item),
      );
  return (
    <section aria-label="Readiness" className="mx-3.5 mt-3.5 shrink-0 text-ui">
      <h3 className="h-6 text-xs leading-6 font-medium text-muted-foreground">
        Readiness
      </h3>
      <div className="border-b">
        <ReadinessRows items={checks} onSelect={onSelect} />
        {children}
        <ReadinessRows items={files} onSelect={onSelect} />
        <ReadinessRows items={comments} onSelect={onSelect} />
      </div>
    </section>
  );
}

function ReadinessRows({
  items,
  onSelect,
}: {
  items: readonly ReadinessItem[];
  onSelect: (key: ReadinessKey) => void;
}) {
  return items.map((item) => (
    <ReadinessRow
      key={item.key}
      name={names[item.key]}
      label={item.label}
      value={item.value}
      tone={
        (item.key === 'comments' || item.key === 'replies') &&
        item.tone === 'attention'
          ? 'open'
          : item.tone
      }
      onSelect={() => onSelect(item.key)}
    />
  ));
}

type RowTone = ReadinessTone | 'progress' | 'open';

function ReadinessRow({
  name,
  label,
  value,
  code,
  tone,
  meter,
  onSelect,
}: {
  name: string;
  label: string;
  value: string;
  code?: string | undefined;
  tone: RowTone;
  meter?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <TruncatedText
      text={label}
      renderTrigger={(_, clip) => (
        <button
          type="button"
          aria-label={label}
          onClick={onSelect}
          className="flex h-7.25 w-full min-w-0 items-center gap-2 border-t text-left leading-4.5 hover:bg-accent"
        >
          <span className="shrink-0 text-muted-foreground">{name}</span>
          <span
            className={cn(
              'ml-auto flex min-w-0 items-center font-medium tabular-nums',
              meter ? 'gap-2' : 'gap-1.5',
              tone === 'failing' && 'text-destructive',
              tone === 'open' && 'text-brand',
            )}
          >
            {meter}
            <ToneIcon tone={tone} />
            {clip(value)}
            {code && (
              <span className="shrink-0 font-mono text-xs leading-4.5">
                {code}
              </span>
            )}
          </span>
        </button>
      )}
    />
  );
}

function ToneIcon({ tone }: { tone: RowTone }) {
  if (tone === 'progress' || tone === 'open') return null;
  if (tone === 'ok')
    return (
      <CheckIcon
        strokeWidth={1.75}
        aria-hidden
        className="size-3.5 shrink-0 text-add-fg"
      />
    );
  if (tone === 'failing')
    return (
      <CircleXIcon
        strokeWidth={1.75}
        aria-hidden
        className="size-3.5 shrink-0 text-destructive"
      />
    );
  return (
    <CircleAlertIcon
      strokeWidth={1.75}
      aria-hidden
      className="size-3.5 shrink-0 text-warn"
    />
  );
}
