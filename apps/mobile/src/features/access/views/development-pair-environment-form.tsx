import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { useDevelopmentPairing } from '../commands/development-pairing';
import { developmentPairingUrl } from '../api';
import { PairEnvironmentFields } from './pair-environment-fields';

export default function DevelopmentPairEnvironmentForm(props: {
  onClose: () => void;
  environmentId?: string;
}) {
  const development = useDevelopmentPairing();
  if (!developmentPairingUrl) return <PairEnvironmentFields {...props} />;
  return (
    <PairEnvironmentFields
      {...props}
      development={{
        waiting: development.result.waiting,
        reset: development.reset,
        renderControl: ({ disabled, onStart, onLink }) => (
          <Box gap={2}>
            <Text variant="ui" tone="muted">
              Create a pairing link for this development server, then select
              Pair.
            </Text>
            <Button
              testID="development-pairing-link"
              label={
                development.result.waiting
                  ? 'Creating pairing link…'
                  : 'Use development server'
              }
              variant="outline"
              pending={development.result.waiting}
              disabled={disabled}
              onPress={() => {
                onStart();
                development.request(onLink);
              }}
            />
            {AsyncResult.isFailure(development.result) ? (
              <Text accessibilityRole="alert" variant="ui" tone="destructive">
                {String(Cause.squash(development.result.cause))}
              </Text>
            ) : null}
          </Box>
        ),
      }}
    />
  );
}
