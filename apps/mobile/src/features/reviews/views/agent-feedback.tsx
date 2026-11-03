import { useAtom } from '@effect/atom-react';
import {
  agentFeedbackControls,
  type AgentFeedbackInput,
} from '@porcelain/client/reviews';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { ErrorState } from '../../../components/ui/error-state';

export function AgentFeedback({
  sendInline = true,
  ...input
}: AgentFeedbackInput & { sendInline?: boolean }) {
  const [view, act] = useAtom(agentFeedbackControls(input));
  if (view.kind === 'loading') return null;
  if (view.kind === 'failure')
    return (
      <ErrorState
        message={view.error}
        retry={{
          label: 'Read agent connection again',
          onPress: () => act('refresh'),
        }}
      />
    );
  return (
    <Box gap={2}>
      {view.session ? (
        <>
          <Text variant="caption" tone="muted" selectable>
            Connected session: {view.session}
          </Text>
          {input.writable ? (
            <Text variant="caption" tone="muted">
              Only saved feedback is sent. Sending keeps the review open.
            </Text>
          ) : null}
        </>
      ) : null}
      {view.status ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {view.status}
        </Text>
      ) : null}
      {view.reason ? (
        <Text variant="caption" tone="muted">
          {view.reason}
        </Text>
      ) : null}
      {view.deliveryError ? <ErrorState message={view.deliveryError} /> : null}
      {view.showActions ? (
        <Box className="flex-row flex-wrap" gap={2}>
          {sendInline ? (
            <Button
              label="Send feedback"
              size="sm"
              pending={view.sending}
              disabled={!view.canSend}
              onPress={() => act('send')}
            />
          ) : null}
          <Button
            label="Disconnect session"
            size="sm"
            variant="tonal"
            pending={view.disconnecting}
            disabled={!view.canDisconnect}
            onPress={() => act('disconnect')}
          />
        </Box>
      ) : null}
      {view.errors.map((error, index) => (
        <ErrorState key={index} message={error} />
      ))}
    </Box>
  );
}

export function SendFeedbackButton(input: AgentFeedbackInput) {
  const [view, act] = useAtom(agentFeedbackControls(input));
  if (view.kind !== 'ready' || !view.showActions) return null;
  return (
    <Button
      label="Send feedback to agent"
      accessibilityLabel="Send feedback"
      variant={view.canSend ? 'filled' : 'tonal'}
      pending={view.sending}
      disabled={!view.canSend}
      onPress={() => act('send')}
    />
  );
}
