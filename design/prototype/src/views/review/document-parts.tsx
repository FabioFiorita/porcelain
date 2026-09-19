import { Check, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ReviewState } from '../../domain/review';

/** "2/5" with a bar, in a document toolbar; hidden on narrow panes. */
export function ProgressPill({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="hidden items-center gap-2 text-[11px] text-muted-foreground @[40rem]:flex"
      title={`${done} of ${total} ${label}`}
    >
      <Progress
        aria-label={label}
        value={total === 0 ? 0 : (done / total) * 100}
        className="w-16"
      />
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

/**
 * The tick in a toolbar: Mark reviewed, Reviewed, or Review again once the code
 * moved on since the tick (the server reports the mark stale).
 */
export function TickButton({
  state,
  noun,
  disabled,
  onClick,
}: {
  state: ReviewState;
  /** "layer" reads "Mark layer reviewed"; nothing reads "Mark reviewed". */
  noun?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={state === 'reviewed' ? 'secondary' : 'outline'}
      disabled={disabled}
      aria-pressed={state === 'reviewed'}
      title={
        state === 'stale' ? 'The code changed since you reviewed it' : undefined
      }
      onClick={onClick}
      className={cn(
        state === 'stale' &&
          'border-amber-500/60 text-amber-700 dark:text-amber-300',
      )}
    >
      {state === 'stale' ? (
        <RotateCw className="size-3.5" />
      ) : (
        <Check className="size-3.5" />
      )}
      {state === 'reviewed'
        ? 'Reviewed'
        : state === 'stale'
          ? 'Review again'
          : noun == null
            ? 'Mark reviewed'
            : `Mark ${noun} reviewed`}
    </Button>
  );
}

/** A file's round tick, at the start of its header in a list of files. */
export function FileTick({
  path,
  state,
  onClick,
}: {
  path: string;
  state: ReviewState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={state === 'reviewed'}
      aria-label={
        state === 'reviewed' ? `Unmark ${path}` : `Mark ${path} reviewed`
      }
      title={state === 'stale' ? 'Changed since you reviewed it' : undefined}
      onClick={onClick}
      className={cn(
        'mr-1 grid size-5 shrink-0 place-items-center rounded-full border font-sans transition-colors',
        state === 'reviewed' && 'border-emerald-600 bg-emerald-600 text-white',
        state === 'stale' && 'border-amber-500 text-amber-600',
        state === 'unreviewed' &&
          'text-muted-foreground hover:border-foreground',
      )}
    >
      {state === 'reviewed' ? (
        <Check className="size-3" strokeWidth={3} />
      ) : state === 'stale' ? (
        <RotateCw className="size-3" />
      ) : null}
    </button>
  );
}

/** A tab whose subject is gone (a replaced layer, a file that is no longer changed). */
export function MissingDocument({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div className="flex max-w-sm flex-col items-center gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[12.5px] text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  );
}
