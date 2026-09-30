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
} from '../rules/review';
import {
  type BulkReviewReport,
  bulkReportText,
  markAllPlan,
  type ReviewableItem,
  reviewedControlLabel,
  type ReviewRange,
  type ReviewsContext,
  WORKTREE_RANGE,
} from '../rules/reviewed';

export function fileReviewControl(
  scope: ReviewScope,
  context: ReviewsContext,
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
  context: ReviewsContext;
  path: string;
  fingerprint: string | null | undefined;
  status: ReviewStatus;
  compact?: boolean;
  range?: ReviewRange;
}) {
  const mark = useMarkReviewed(scope, context, range);
  const unmark = useUnmarkReviewed(scope, context, range);
  const pending = mark.isPending || unmark.isPending;
  const error = mark.error ?? unmark.error;

  if (fingerprint == null)
    return (
      <span
        title={`${path} cannot be marked as reviewed because its current state could not be established`}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
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
        {pending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : reviewed ? (
          <CheckIcon />
        ) : status === 'stale' ? (
          <RotateCcwIcon />
        ) : (
          <CheckIcon className={cn(compact && 'invisible')} />
        )}
        {!compact &&
          (reviewed
            ? 'Reviewed'
            : status === 'stale'
              ? 'Review again'
              : 'Mark reviewed')}
      </Button>
      {error && (
        <span
          role="alert"
          className="max-w-52 truncate text-[11px] text-destructive"
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
  kind = 'all',
  range = WORKTREE_RANGE,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  entries: readonly ReviewableItem[];
  compact?: boolean;
  kind?: 'all' | 'layer';
  range?: ReviewRange;
}) {
  const bulk = useMarkAllReviewed(scope, context, range);
  const plan = markAllPlan(entries, kind);
  const pending = bulk.isPending;
  const disabled = plan.blocked || pending;
  const submit = () => {
    if (disabled) return;
    if (plan.unmarking) bulk.unmarkAll(plan.reviewedPaths);
    else bulk.markAll(plan.entries);
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
        {pending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : plan.unmarking ? (
          <RotateCcwIcon />
        ) : (
          <CheckIcon />
        )}
        {!compact &&
          (pending ? (plan.unmarking ? 'Unmarking…' : 'Marking…') : plan.text)}
      </Button>
      {bulk.report && <BulkReport report={bulk.report} />}
      {bulk.error && (
        <span
          role="alert"
          className="max-w-64 text-right text-[11px] text-destructive"
        >
          {reviewErrorMessage(bulk.error)}
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
        'max-w-64 text-right text-[11px] leading-tight',
        failed > 0 ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {failed > 0 && <CircleAlertIcon className="mr-1 inline size-3" />}
      {bulkReportText(report)}
    </span>
  );
}
