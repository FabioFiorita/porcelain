import { useId } from 'react';
import { TruncatedText } from '@/shared/views/truncated-text';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { reviewedCommandFailure } from '@porcelain/client/reviews';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  CheckIcon,
  CircleAlertIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  useMarkAllReviewed,
  useMarkReviewed,
  useUnmarkReviewed,
} from '../commands/reviewed';
import {
  reviewErrorMessage,
  type ReviewChangeItem,
  type ReviewScope,
  type ReviewStatus,
} from '@porcelain/client/reviews/rules';
import {
  type BulkReviewReport,
  bulkReportText,
  markAllPlan,
  type ReviewableItem,
  reviewedControlLabel,
  unavailableReviewText,
  type ReviewRange,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function fileReviewControl(
  scope: ReviewScope,
  context: ConnectionContext,
  item: ReviewChangeItem,
) {
  return {
    path: item.path,
    fingerprint: item.fingerprint ?? null,
    reviewed: item.reviewStatus === 'reviewed',
    stale: item.reviewStatus === 'stale',
    control: (
      <ReviewedControl
        key={`review:${item.path}`}
        scope={scope}
        context={context}
        path={item.path}
        fingerprint={item.fingerprint}
        status={item.reviewStatus}
        compact
      />
    ),
  };
}

export function ReviewedControl({
  scope,
  context,
  path,
  fingerprint,
  status,
  compact = false,
  range = WORKTREE_RANGE,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  path: string;
  fingerprint: string | null | undefined;
  status: ReviewStatus;
  compact?: boolean;
  range?: ReviewRange;
}) {
  const mark = useMarkReviewed(scope, context, range);
  const unmark = useUnmarkReviewed(scope, context, range);
  const pending = mark.result.waiting || unmark.result.waiting;
  const error = reviewedCommandFailure(mark.result, unmark.result);

  if (fingerprint === null || fingerprint === undefined)
    return (
      <span
        title={unavailableReviewText([path])}
        className="inline-flex items-center gap-1 text-2xs text-muted-foreground"
      >
        <EyeOffIcon className="size-3" aria-hidden="true" />
        {compact ? 'Not reviewable' : 'Not reviewable: too large or unreadable'}
      </span>
    );

  const reviewed = status === 'reviewed';
  const label = reviewedControlLabel(path, status);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size={compact ? 'icon-xs' : 'xs'}
              variant={reviewed ? 'ghost' : 'outline'}
              aria-pressed={reviewed}
              disabled={pending}
              aria-label={label}
              onClick={() => {
                if (reviewed) unmark.start(path);
                else mark.start({ path, fingerprint });
              }}
            >
              <ReviewedIcon
                pending={pending}
                status={status}
                compact={compact}
              />
              {!compact && reviewedText(status)}
            </Button>
          }
        />
        <TooltipContent role="tooltip" className="break-all">
          {label}
        </TooltipContent>
      </Tooltip>
      {error !== undefined && (
        <TruncatedText
          className="max-w-52 text-2xs text-destructive"
          render={<span role="alert" />}
          text={reviewErrorMessage(error)}
        />
      )}
    </span>
  );
}

export function ReviewedCheckbox({
  scope,
  context,
  path,
  fingerprint,
  status,
  latest,
  onStart,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  path: string;
  fingerprint: string | null | undefined;
  status: ReviewStatus;
  latest: boolean;
  onStart: () => void;
}) {
  const mark = useMarkReviewed(scope, context, WORKTREE_RANGE);
  const unmark = useUnmarkReviewed(scope, context, WORKTREE_RANGE);
  const busy = mark.result.waiting || unmark.result.waiting;
  const pending = latest && busy;
  const failure = reviewedCommandFailure(mark.result, unmark.result);
  const error = latest ? failure : undefined;
  const hintId = useId();
  const reviewed = status === 'reviewed';
  const reviewable = fingerprint !== null && fingerprint !== undefined;
  const staleHint =
    status === 'stale' ? 'Changed since reviewed' : 'Toggle reviewed';
  const hint = reviewable ? staleHint : unavailableReviewText([path]);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              role="checkbox"
              aria-checked={reviewed}
              aria-label={`${path} reviewed`}
              aria-describedby={hintId}
              aria-invalid={error !== undefined}
              aria-disabled={busy || !reviewable}
              onClick={() => {
                if (busy || fingerprint === null || fingerprint === undefined)
                  return;
                onStart();
                if (reviewed) unmark.start(path);
                else mark.start({ path, fingerprint });
              }}
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-checkbox border-(length:--border-checkbox) border-border-strong bg-background text-background outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed',
                !reviewable && 'opacity-50',
                reviewed && 'border-foreground bg-foreground',
                status === 'stale' && 'border-warn',
                error !== undefined && 'border-destructive',
              )}
            />
          }
        >
          {pending ? (
            <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" />
          ) : (
            reviewed && <CheckIcon className="size-3" strokeWidth={3} />
          )}
        </TooltipTrigger>
        <TooltipContent role="tooltip" className="break-all">
          {error === undefined ? hint : reviewErrorMessage(error)}
        </TooltipContent>
      </Tooltip>
      <span id={hintId} hidden>
        {hint}
      </span>
      {error !== undefined && (
        <span role="alert" className="sr-only">
          {reviewErrorMessage(error)}
        </span>
      )}
    </>
  );
}

export function MarkAllReviewed({
  scope,
  context,
  entries,
  compact = false,
  range = WORKTREE_RANGE,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  entries: readonly ReviewableItem[];
  compact?: boolean;
  range?: ReviewRange;
}) {
  const bulk = useMarkAllReviewed(scope, context, range);
  const plan = markAllPlan(entries);
  const pending = bulk.result.waiting;
  const disabled = plan.blocked || pending;
  const submit = () => {
    if (disabled) return;
    if (plan.unmarking)
      bulk.start({ kind: 'unmark', paths: plan.reviewedPaths });
    else bulk.start({ kind: 'mark', entries: plan.entries });
  };

  return (
    <span className="inline-flex min-w-0 flex-col items-end gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size={compact ? 'icon-xs' : 'xs'}
              variant="outline"
              disabled={disabled}
              aria-label={plan.label}
              onClick={submit}
            >
              <MarkAllIcon pending={pending} unmarking={plan.unmarking} />
              {!compact && markAllText(pending, plan.unmarking, plan.text)}
            </Button>
          }
        />
        <TooltipContent role="tooltip" className="break-all">
          {plan.label}
        </TooltipContent>
      </Tooltip>
      {bulk.report && <BulkReport report={bulk.report} />}
      {AsyncResult.isFailure(bulk.result) && (
        <span
          role="alert"
          className="max-w-64 text-right text-2xs text-destructive"
        >
          {reviewErrorMessage(Cause.squash(bulk.result.cause))}
        </span>
      )}
    </span>
  );
}

function ReviewedIcon({
  pending,
  status,
  compact,
}: {
  pending: boolean;
  status: ReviewStatus;
  compact: boolean;
}) {
  if (pending) return <LoaderCircleIcon className="animate-spin" />;
  if (status === 'reviewed') return <CheckIcon />;
  if (status === 'stale') return <RotateCcwIcon />;
  return <CheckIcon className={cn(compact && 'invisible')} />;
}

function reviewedText(status: ReviewStatus) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Review again';
  return 'Mark reviewed';
}

function MarkAllIcon({
  pending,
  unmarking,
}: {
  pending: boolean;
  unmarking: boolean;
}) {
  if (pending) return <LoaderCircleIcon className="animate-spin" />;
  if (unmarking) return <RotateCcwIcon />;
  return <CheckIcon />;
}

function markAllText(pending: boolean, unmarking: boolean, text: string) {
  if (!pending) return text;
  return unmarking ? 'Unmarking…' : 'Marking…';
}

function BulkReport({ report }: { report: BulkReviewReport }) {
  const failed = report.failed.length;
  return (
    <span
      role={failed > 0 ? 'alert' : 'status'}
      className={cn(
        'max-w-64 text-right text-2xs leading-tight',
        failed > 0 ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {failed > 0 && <CircleAlertIcon className="mr-1 inline size-3" />}
      {bulkReportText(report)}
    </span>
  );
}
