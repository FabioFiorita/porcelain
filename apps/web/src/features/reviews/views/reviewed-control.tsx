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
  const error = (() => {
    if (AsyncResult.isFailure(mark.result)) {
      return Cause.squash(mark.result.cause);
    }
    if (AsyncResult.isFailure(unmark.result)) {
      return Cause.squash(unmark.result.cause);
    }
    return undefined;
  })();

  if (fingerprint === null || fingerprint === undefined)
    return (
      <span
        title={`${path} cannot be marked as reviewed because its current state could not be established`}
        className="inline-flex items-center gap-1 text-2xs text-muted-foreground"
      >
        <EyeOffIcon className="size-3" aria-hidden="true" />
        <span className={cn(compact && 'sr-only')}>Not reviewable</span>
      </span>
    );

  const reviewed = status === 'reviewed';
  const label = reviewedControlLabel(path, status);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Button
        type="button"
        size={compact ? 'icon-xs' : 'xs'}
        variant={reviewed ? 'ghost' : 'outline'}
        className={cn(compact && 'size-5 ', compact && reviewed && '    ')}
        aria-pressed={reviewed}
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() => {
          if (reviewed) unmark.start(path);
          else mark.start({ path, fingerprint });
        }}
      >
        {(() => {
          if (pending) {
            return <LoaderCircleIcon className="animate-spin" />;
          }
          if (reviewed) {
            return <CheckIcon />;
          }
          if (status === 'stale') {
            return <RotateCcwIcon />;
          }
          return <CheckIcon className={cn(compact && 'invisible')} />;
        })()}
        {!compact &&
          (() => {
            if (reviewed) {
              return 'Reviewed';
            }
            if (status === 'stale') {
              return 'Review again';
            }
            return 'Mark reviewed';
          })()}
      </Button>
      {error !== undefined && (
        <span
          role="alert"
          className="max-w-52 truncate text-2xs text-destructive"
        >
          {reviewErrorMessage(error)}
        </span>
      )}
    </span>
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
      <Button
        type="button"
        size={compact ? 'icon-xs' : 'xs'}
        variant="outline"
        disabled={disabled}
        aria-label={plan.label}
        title={plan.label}
        onClick={submit}
      >
        {(() => {
          if (pending) {
            return <LoaderCircleIcon className="animate-spin" />;
          }
          if (plan.unmarking) {
            return <RotateCcwIcon />;
          }
          return <CheckIcon />;
        })()}
        {!compact &&
          (() => {
            if (pending) {
              if (plan.unmarking) {
                return 'Unmarking…';
              }
              return 'Marking…';
            }
            return plan.text;
          })()}
      </Button>
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
