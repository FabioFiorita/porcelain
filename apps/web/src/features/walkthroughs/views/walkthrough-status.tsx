import {
  walkthroughProgress,
  walkthroughFreshnessText,
  walkthroughFailureCopy,
  type WalkthroughStatusInput,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';

export function WalkthroughStatus({
  run,
  requesting = false,
  reused = false,
  freshness,
  failure,
  onUpdate,
}: WalkthroughStatusInput) {
  const progress = walkthroughProgress(run, requesting);
  return (
    <section
      aria-label="Walkthrough status"
      className="flex flex-col gap-3 rounded-lg border p-4 text-ui"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="font-medium">
          {progress.label}
        </p>
        {!progress.active && onUpdate && (
          <Button size="sm" variant="outline" onClick={onUpdate}>
            {failure ? 'Try again' : 'Update walkthrough'}
          </Button>
        )}
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
          className="h-full bg-primary"
          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
        />
      </div>
      <ol
        aria-label="Update stages"
        className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground"
      >
        {progress.steps.map((step, index) => (
          <li
            key={step}
            aria-current={
              !requesting && index === progress.completed ? 'step' : undefined
            }
          >
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      {requesting && <p>Sending the request and capturing the current work.</p>}
      {freshness && (
        <p className="text-foreground-2">
          {progress.active
            ? 'Showing the saved walkthrough while the update runs.'
            : walkthroughFreshnessText(freshness)}
        </p>
      )}
      {failure && (
        <p role="alert">
          {walkthroughFailureCopy(failure.failure, failure.writer).title}
          {failure.failure.kind !== 'signed_out' &&
            ` ${failure.failure.message}`}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-muted-foreground">
          Update log
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
              This walkthrough predates the update log. Its recorded status is
              shown above.
            </li>
          )}
        </ol>
      </details>
    </section>
  );
}
