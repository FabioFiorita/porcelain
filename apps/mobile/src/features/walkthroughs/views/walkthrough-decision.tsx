import {
  callDecision,
  callOptions,
  decidedOption,
  decidedWhen,
  decisionAuthor,
  type WalkthroughComparison,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import { useDecideCall } from '../commands/conversations';
import {
  useConversations,
  type ConversationOwner,
} from '../queries/conversations';

export function CallDecision({
  owner,
  step,
  index,
  comparison,
}: {
  owner: ConversationOwner;
  step: number;
  index: number;
  comparison: WalkthroughComparison | undefined;
}) {
  const { view, failed } = useConversations(owner);
  const { decide, waiting, failure } = useDecideCall(owner);
  const blocked = useWritesBlocked(owner.workspace.connection.environmentId);
  const disabled = waiting || blocked || view === undefined;
  const decision = callDecision(view?.decisions, step, index);
  const options = callOptions(comparison);
  const problem =
    failure ?? (failed ? 'Decisions could not be read.' : undefined);
  return (
    <Box gap={2}>
      {decision ? (
        <Box
          className="flex-row flex-wrap items-center"
          gap={2}
          accessibilityLiveRegion="polite"
        >
          <Icon name="check" tone="add" size="small" />
          <Text variant="secondary" weight="medium">
            {decidedOption(decision)}
          </Text>
          <Text variant="caption" tone="muted">
            {decisionAuthor(decision)} · {decidedWhen(decision.decidedAt)}
          </Text>
          <Button
            label="Undo"
            variant="plain"
            size="sm"
            disabled={disabled}
            onPress={() => decide({ step, call: index, decided: false })}
          />
        </Box>
      ) : (
        <Box className="flex-row flex-wrap" gap={2}>
          {options.length > 0 ? (
            options.map((option) => (
              <Button
                key={option}
                label={`Choose ${option}`}
                variant="tonal"
                size="sm"
                disabled={disabled}
                onPress={() =>
                  decide({ step, call: index, decided: true, option })
                }
              />
            ))
          ) : (
            <Button
              label="Mark decided"
              variant="tonal"
              size="sm"
              disabled={disabled}
              onPress={() => decide({ step, call: index, decided: true })}
            />
          )}
        </Box>
      )}
      {problem ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
    </Box>
  );
}
