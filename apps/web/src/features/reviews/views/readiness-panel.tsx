import { TruncatedText } from '@/shared/views/truncated-text';
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleXIcon,
} from 'lucide-react';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { readReview, readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionProgress,
  type ReviewMarks,
} from '@porcelain/client/reviews/rules';
import { Suspense, type ReactNode } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePreferences } from '@/features/preferences/index';
import { useBranchChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { useReviewedMarks } from '../queries/reviewed';
import { ProgressMeter } from './progress-meter';
import type { CommentThread } from '@porcelain/client/reviews/rules';
import {
  type ReadinessItem,
  type ReadinessKey,
  readinessItems,
  readinessSummary,
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
      onSelect={onSelect}
      summary={
        review?.reviewId ? (
          <PublishedSummary
            items={items}
            review={review}
            reviewId={review.reviewId}
            context={context}
            marks={marks}
          />
        ) : undefined
      }
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
  const proofValue = proven
    ? `Proven at ${review.headOid?.slice(0, 7) ?? 'published head'}`
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
        value={proofValue}
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
        tone={
          progress && progress.reviewed === progress.total ? 'ok' : 'attention'
        }
        meter={
          progress && (
            <ProgressMeter
              label="Decisions reviewed"
              value={progress.reviewed}
              max={progress.total}
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
  const { preferences } = usePreferences();
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
            specsApart: preferences.collapseSpecs,
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

function PublishedSummary({
  items,
  ...input
}: PublishedProgressInput & { items: readonly ReadinessItem[] }) {
  const { progress } = usePublishedProgress(input);
  const tone: ReadinessTone =
    progress && progress.reviewed === progress.total ? 'ok' : 'attention';
  return (
    <TruncatedText
      className="ml-auto min-w-0 text-2xs"
      text={readinessSummary([...items, { tone }])}
    />
  );
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
  onSelect,
  children,
  summary,
}: {
  items: readonly ReadinessItem[];
  onSelect: (key: ReadinessKey) => void;
  children?: ReactNode;
  summary?: ReactNode;
}) {
  const primary = items.filter(
    (item) =>
      item.key === 'checks' ||
      item.key === 'comments' ||
      item.key === 'replies',
  );
  const details = items.filter((item) => !primary.includes(item));
  return (
    <section aria-label="Readiness" className="mx-3 mt-3 shrink-0 text-ui">
      <Collapsible defaultOpen className="group/readiness">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex h-6 w-full min-w-0 items-center gap-1.5 text-left text-caption text-muted-foreground hover:text-foreground"
            />
          }
        >
          <span className="font-medium">Readiness</span>
          {summary ?? (
            <TruncatedText
              className="ml-auto min-w-0 text-2xs"
              text={readinessSummary(items)}
            />
          )}
          <ChevronDownIcon
            aria-hidden
            className="size-3 shrink-0 transition-transform group-data-closed/readiness:-rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-b">
            <ReadinessRows
              items={primary.filter((item) => item.key === 'checks')}
              onSelect={onSelect}
            />
            {children}
            <ReadinessRows
              items={primary.filter((item) => item.key !== 'checks')}
              onSelect={onSelect}
            />
          </div>
          <Collapsible className="group/details">
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex h-6 w-full items-center justify-between text-left text-caption text-muted-foreground hover:text-foreground"
                />
              }
            >
              Files and explanation
              <ChevronDownIcon
                aria-hidden
                className="size-3 transition-transform group-data-closed/details:-rotate-90"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ReadinessRows items={details} onSelect={onSelect} />
            </CollapsibleContent>
          </Collapsible>
        </CollapsibleContent>
      </Collapsible>
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
      tone={item.tone}
      onSelect={() => onSelect(item.key)}
    />
  ));
}

function ReadinessRow({
  name,
  label,
  value,
  tone,
  meter,
  onSelect,
}: {
  name: string;
  label: string;
  value: string;
  tone: ReadinessTone;
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
          className="flex h-7 w-full min-w-0 items-center gap-2 border-t text-left hover:bg-accent"
        >
          <span className="shrink-0 text-muted-foreground">{name}</span>
          <span
            className={cn(
              'ml-auto flex min-w-0 items-center gap-1.5 font-medium tabular-nums',
              tone === 'failing' && 'text-destructive',
            )}
          >
            {meter}
            <ToneIcon tone={tone} />
            {clip(value)}
          </span>
        </button>
      )}
    />
  );
}

function ToneIcon({ tone }: { tone: ReadinessTone }) {
  if (tone === 'ok')
    return <CheckIcon aria-hidden className="size-3.5 shrink-0 text-add-fg" />;
  if (tone === 'failing')
    return (
      <CircleXIcon aria-hidden className="size-3.5 shrink-0 text-destructive" />
    );
  return (
    <CircleAlertIcon aria-hidden className="size-3.5 shrink-0 text-warn" />
  );
}
