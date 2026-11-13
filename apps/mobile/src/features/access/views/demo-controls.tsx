import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';
import { useDemo } from '../commands/demo';
import { useEnvironments } from '../store';

export function DemoControls() {
  const { result, run, environmentId } = useDemo();
  const active = useEnvironments().some(
    (remote) => remote.environmentId === environmentId,
  );
  return (
    <Box gap={2}>
      <Text weight="medium">Try Porcelain without a computer</Text>
      <Text variant="caption" tone="muted">
        Explore a sample Walkthrough, changes, files and history. Demo data
        stays on this device; conversation replies are simulated. Samples reset
        when you restart the app, reset or exit the demo.
      </Text>
      <Box className="items-start" gap={2}>
        {active ? (
          <>
            <Button
              testID="demo-reset"
              label="Reset demo"
              variant="tonal"
              disabled={result.waiting}
              onPress={() => run('reset')}
            />
            <Button
              testID="demo-exit"
              label="Exit demo"
              variant="plain"
              disabled={result.waiting}
              onPress={() => run('exit')}
            />
          </>
        ) : (
          <Button
            testID="demo-start"
            label="Try the demo"
            variant="tonal"
            disabled={result.waiting}
            onPress={() => run('start')}
          />
        )}
      </Box>
      {AsyncResult.isFailure(result) ? (
        <ErrorState
          message={connectionErrorMessage(Cause.squash(result.cause))}
        />
      ) : null}
    </Box>
  );
}

export function DemoNotice({
  environmentId,
}: {
  environmentId: string | undefined;
}) {
  const demo = useDemo();
  if (environmentId !== demo.environmentId) return null;
  return (
    <Box paddingX={4} paddingY={2}>
      <Text variant="caption" tone="muted">
        Demo · Sample data on this device. Reset or exit in Settings.
      </Text>
    </Box>
  );
}
