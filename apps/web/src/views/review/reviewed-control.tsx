import {
  CheckIcon,
  CircleAlertIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  ReviewChangeItem,
  ReviewScope,
  ReviewStatus,
} from '../../domain/review';
import { isFingerprintable } from '../../domain/review';
import {
  type BulkReviewReport,
  reviewErrorMessage,
  useMarkAllReviewed,
  useMarkReviewed,
  useUnmarkReviewed,
} from '../../query/review';

export function ReviewedControl({
  scope,
  path,
  fingerprint,
  status,
  compact = false,
}: {
  scope: ReviewScope;
  path: string;
  fingerprint: string | null;
  status: ReviewStatus;
  compact?: boolean;
}) {
  const mark = useMarkReviewed(scope);
  const unmark = useUnmarkReviewed(scope);
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
  const label = reviewed
    ? `Unmark ${path} as unreviewed`
    : status === 'stale'
      ? `Mark changed ${path} as reviewed`
      : `Mark ${path} as reviewed`;
  const submit = async () => {
    try {
      if (reviewed) await unmark.submit(path);
      else await mark.submit({ path, fingerprint });
    } catch {
      // The mutation owns the error state rendered below. Contain the
      // rejected mutateAsync promise so a failed click is not an unhandled
      // rejection in the browser.
    }
  };
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Button
        type="button"
        size={compact ? 'icon-xs' : 'xs'}
        variant={reviewed ? 'ghost' : 'outline'}
        className={cn(
          compact && 'size-5 rounded-full',
          compact &&
            reviewed &&
            'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
        )}
        aria-pressed={reviewed}
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() => void submit()}
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
  entries,
  compact = false,
  kind = 'all',
}: {
  scope: ReviewScope;
  entries: readonly ReviewChangeItem[];
  compact?: boolean;
  kind?: 'all' | 'layer';
}) {
  const bulk = useMarkAllReviewed(scope);
  const unmark = useUnmarkReviewed(scope);
  const [report, setReport] = useState<BulkReviewReport | null>(null);
  const uniqueEntries = [
    ...new Map(entries.map((entry) => [entry.path, entry])).values(),
  ];
  const fingerprintable = uniqueEntries.filter(isFingerprintable);
  const eligible = fingerprintable.filter(
    (entry) => entry.fingerprint != null && entry.reviewStatus !== 'reviewed',
  );
  const reviewed = fingerprintable.filter(
    (entry) => entry.reviewStatus === 'reviewed',
  );
  const unavailable = uniqueEntries.length - fingerprintable.length;
  const unmarking = eligible.length === 0 && reviewed.length > 0;
  const completeLabel =
    unavailable > 0
      ? `${fingerprintable.length} reviewed · ${unavailable} unavailable`
      : 'All reviewed';
  const noun = kind === 'layer' ? 'layer' : 'all';
  const pending = bulk.isPending || unmark.isPending;
  const disabled =
    fingerprintable.length === 0 ||
    pending ||
    (eligible.length === 0 && reviewed.length === 0);
  const buttonLabel =
    fingerprintable.length === 0
      ? 'No files can be marked reviewed'
      : unmarking
        ? `Unmark ${noun}`
        : eligible.length === 0
          ? completeLabel
          : kind === 'layer'
            ? 'Mark layer reviewed'
            : `Mark all ${eligible.length} files reviewed`;

  const submit = () => {
    if (disabled) return;
    setReport(null);
    if (unmarking) {
      void (async () => {
        try {
          for (const entry of reviewed) await unmark.submit(entry.path);
        } catch {
          /* Mutation error is rendered below. */
        }
      })();
      return;
    }
    void bulk
      .submit(uniqueEntries)
      .then(setReport)
      .catch(() => undefined);
  };

  return (
    <span className="inline-flex min-w-0 flex-col items-end gap-1">
      <Button
        type="button"
        size={compact ? 'icon-xs' : 'xs'}
        variant="outline"
        disabled={disabled}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={submit}
      >
        {pending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : unmarking ? (
          <RotateCcwIcon />
        ) : (
          <CheckIcon />
        )}
        {!compact &&
          (pending
            ? unmarking
              ? 'Unmarking…'
              : 'Marking…'
            : fingerprintable.length === 0
              ? 'No reviewable files'
              : unmarking
                ? `Unmark ${noun}`
                : eligible.length === 0
                  ? completeLabel
                  : kind === 'layer'
                    ? 'Mark layer reviewed'
                    : 'Mark all reviewed')}
      </Button>
      {report && <BulkReport report={report} />}
      {(bulk.error || unmark.error) && (
        <span
          role="alert"
          className="max-w-64 text-right text-[11px] text-destructive"
        >
          {reviewErrorMessage(bulk.error ?? unmark.error)}
        </span>
      )}
    </span>
  );
}

function BulkReport({ report }: { report: BulkReviewReport }) {
  const failed = report.failed.length;
  const skipped = report.skipped.length;
  const result = [
    report.marked.length > 0
      ? `Marked ${report.marked.length} ${report.marked.length === 1 ? 'file' : 'files'}.`
      : 'No files marked.',
    skipped > 0 ? `Skipped ${skipped}.` : '',
    failed > 0 ? `${failed} failed.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      role={failed > 0 ? 'alert' : 'status'}
      className={cn(
        'max-w-64 text-right text-[11px] leading-tight',
        failed > 0 ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {failed > 0 && <CircleAlertIcon className="mr-1 inline size-3" />}
      {result}
    </span>
  );
}
