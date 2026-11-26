import { useState, type ReactNode } from 'react';
import { Progress } from '../../../components/ui/progress';
import {
  walkthroughProgress,
  walkthroughFreshnessText,
  walkthroughFailureCopy,
  type WalkthroughStatusInput,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';

export function WalkthroughStatus({
  run,
  requesting = false,
  reused = false,
  freshness,
  failure,
  onUpdate,
  writeBlock,
  writerNotice,
  updateDisabled = false,
}: WalkthroughStatusInput & {
  writeBlock?: string | undefined;
  writerNotice?: ReactNode;
  updateDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const progress = walkthroughProgress(run, requesting);
  const log = (
    <>
      <Button
        label={open ? 'Hide update log' : 'Update log'}
        variant="plain"
        size="sm"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Box gap={2} className="w-full">
          {progress.entries.map((entry, index) => (
            <Text key={`${entry.at}:${index}`} variant="secondary" tone="muted">
              {new Date(entry.at).toLocaleString()} · {entry.message}
            </Text>
          ))}
          {progress.entries.length === 0 && (
            <Text variant="secondary" tone="muted">
              This walkthrough predates the update log.
            </Text>
          )}
        </Box>
      )}
    </>
  );
  if (
    run.state.status === 'ready' &&
    !progress.active &&
    !requesting &&
    !failure &&
    !reused
  )
    return (
      <Box gap={1}>
        <Text variant="secondary" tone="muted" accessibilityLiveRegion="polite">
          {[
            `Saved ${new Date(run.state.writtenAt).toLocaleString()}`,
            freshness ? walkthroughFreshnessText(freshness) : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Box className="flex-row flex-wrap items-center" gap={2}>
          {writerNotice}
          {onUpdate ? (
            <Button
              label="Update walkthrough"
              variant="tonal"
              size="sm"
              disabled={Boolean(writeBlock) || updateDisabled}
              onPress={onUpdate}
            />
          ) : null}
          {log}
        </Box>
      </Box>
    );
  return (
    <Box gap={3} padding={4} surface="panel">
      <Text weight="medium" accessibilityLiveRegion="polite">
        {progress.label}
      </Text>
      {run.state.status === 'ready' && (
        <Text variant="secondary" tone="muted">
          Last written {new Date(run.state.writtenAt).toLocaleString()}
        </Text>
      )}
      {reused && !requesting && (
        <Text variant="secondary" tone="muted">
          This snapshot already has a walkthrough. The saved version was reused.
        </Text>
      )}
      <Progress
        value={progress.completed}
        total={progress.total}
        label={progress.label}
        accessibilityLabel="Walkthrough stages"
      />
      <Text variant="secondary" tone="muted">
        {progress.steps
          .map((step, index) => `${index + 1}. ${step}`)
          .join(' · ')}
      </Text>
      {requesting && (
        <Text variant="secondary">
          Sending the request and capturing the current work.
        </Text>
      )}
      {freshness && (
        <Text variant="secondary" tone="muted">
          {progress.active
            ? 'Showing the saved walkthrough while the update runs.'
            : walkthroughFreshnessText(freshness)}
        </Text>
      )}
      {failure && (
        <Text accessibilityRole="alert">
          {walkthroughFailureCopy(failure.failure, failure.writer).title}
          {failure.failure.kind !== 'signed_out' &&
            ` ${failure.failure.message}`}
        </Text>
      )}
      {!progress.active && writerNotice}
      {!progress.active && onUpdate && (
        <Button
          label={failure ? 'Try again' : 'Update walkthrough'}
          variant="tonal"
          size="sm"
          disabled={Boolean(writeBlock) || updateDisabled}
          onPress={onUpdate}
        />
      )}
      {log}
    </Box>
  );
}
