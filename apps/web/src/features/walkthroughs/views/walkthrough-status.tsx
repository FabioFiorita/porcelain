import {
  walkthroughProgress,
  walkthroughFreshnessText,
  walkthroughFailureCopy,
  type WalkthroughStatusInput,
} from '@porcelain/client/walkthroughs/rules';
import type { ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { WriterAction } from './walkthrough-writer-notice';

export function WalkthroughFailureLine({
  copy,
}: {
  copy: ReturnType<typeof walkthroughFailureCopy>;
}) {
  return (
    <p role="alert" className="min-w-0 flex-1 basis-64 font-medium text-pretty">
      {copy.title}
      {copy.message && ` ${copy.message}`}
    </p>
  );
}

export function WalkthroughStatus({
  run,
  requesting = false,
  first = false,
  reused = false,
  freshness,
  failure,
  onUpdate,
  writeBlock,
  controls,
}: WalkthroughStatusInput & {
  writeBlock?: string | undefined;
  controls?: ((action: WriterAction) => ReactNode) | undefined;
}) {
  const progress = walkthroughProgress(run, requesting, first);
  if (
    run.state.status === 'ready' &&
    !progress.active &&
    !requesting &&
    !failure
  ) {
    const behind = freshness === 'changed';
    return (
      <section
        aria-label="Walkthrough status"
        className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground"
      >
        <p role="status">
          {reused && !behind ? (
            'Already up to date: the saved walkthrough was reused.'
          ) : (
            <>
              Saved{' '}
              <time dateTime={run.state.writtenAt}>
                {new Date(run.state.writtenAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
              {behind && ' · Behind the current work'}
            </>
          )}
        </p>
        {onUpdate &&
          controls?.({
            label: 'Update walkthrough',
            variant: behind ? 'outline' : 'ghost',
            disabled: Boolean(writeBlock),
            description: writeBlock,
            onClick: onUpdate,
          })}
      </section>
    );
  }
  return (
    <section
      aria-label="Walkthrough status"
      className="flex flex-col gap-3 rounded-lg border p-4 text-ui"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {failure && !progress.active ? (
          <WalkthroughFailureLine
            copy={walkthroughFailureCopy(failure.failure, failure.writer)}
          />
        ) : (
          <p role="status" className="font-medium">
            {progress.label}
          </p>
        )}
        {!progress.active &&
          onUpdate &&
          controls?.({
            label: failure ? 'Try again' : 'Update walkthrough',
            disabled: Boolean(writeBlock),
            description: writeBlock,
            onClick: onUpdate,
          })}
      </div>
      {run.state.status === 'ready' && (
        <p className="text-caption text-muted-foreground">
          Last written{' '}
          <time dateTime={run.state.writtenAt}>
            {new Date(run.state.writtenAt).toLocaleString()}
          </time>
        </p>
      )}
      {reused && !requesting && (
        <p className="text-caption text-muted-foreground">
          This snapshot already has a walkthrough. The saved version was reused.
        </p>
      )}
      <div
        role="progressbar"
        aria-label="Walkthrough stages"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
        aria-valuetext={progress.label}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full',
            run.state.status === 'failed' ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
        />
      </div>
      <ol
        aria-label="Update stages"
        className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground"
      >
        {progress.steps.map((step, index) => {
          const current = !requesting && index === progress.completed;
          const done = index < progress.completed;
          return (
            <li
              key={step}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1',
                current && 'font-medium text-foreground',
                current && run.state.status === 'failed' && 'text-destructive',
              )}
            >
              {done ? (
                <CheckIcon
                  aria-label="Done"
                  className="size-3 shrink-0 text-add-fg"
                />
              ) : (
                <span className="tabular-nums">{index + 1}.</span>
              )}
              {step}
            </li>
          );
        })}
      </ol>
      {requesting && <p>Sending the request and capturing the current work.</p>}
      {freshness &&
        (progress.active || walkthroughFreshnessText(freshness)) && (
          <p className="text-foreground-2">
            {progress.active
              ? 'Showing the saved walkthrough while the update runs.'
              : walkthroughFreshnessText(freshness)}
          </p>
        )}
      <details>
        <summary className="cursor-pointer text-muted-foreground">
          Writing log
        </summary>
        <ol className="mt-2 flex flex-col gap-2 text-caption text-foreground-2">
          {progress.entries.map((entry, index) => (
            <li key={`${entry.at}:${index}`}>
              <time dateTime={entry.at} className="mr-2 font-mono">
                {new Date(entry.at).toLocaleString()}
              </time>
              {entry.message}
            </li>
          ))}
          {progress.entries.length === 0 && (
            <li>
              This walkthrough predates the writing log. Its recorded status is
              shown above.
            </li>
          )}
        </ol>
      </details>
    </section>
  );
}
