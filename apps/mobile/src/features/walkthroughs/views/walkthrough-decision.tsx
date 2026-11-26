import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readDeviceLabels, readViewer } from '@porcelain/client/access';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  NEEDS_A_COMMIT,
  callChoices,
  callDeciding,
  callDecision,
  callState,
  decidedOption,
  decidedWhen,
  decisionPlace,
  type WalkthroughComparison,
} from '@porcelain/client/walkthroughs/rules';
import { Badge } from '../../../components/ui/badge';
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

type Decider = { kind: 'owner' } | { kind: 'device'; deviceId: string };

function DeviceLabels({
  connection,
  decidedBy,
  viewer,
}: {
  connection: RuntimeConnection;
  decidedBy: Decider;
  viewer: Decider | undefined;
}) {
  const result = useAtomValue(readDeviceLabels(connection));
  if (AsyncResult.isInitial(result)) return null;
  const labels = Option.getOrUndefined(AsyncResult.value(result));
  const place = decisionPlace(decidedBy, viewer, labels);
  return place ? `${place} · ` : null;
}

function DecisionPlace({
  connection,
  decidedBy,
}: {
  connection: RuntimeConnection;
  decidedBy: Decider;
}) {
  const viewer = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readViewer(connection))),
  );
  const place = decisionPlace(decidedBy, viewer, undefined);
  if (place === undefined) return null;
  if (decidedBy.kind === 'owner') return `${place} · `;
  return (
    <DeviceLabels
      connection={connection}
      decidedBy={decidedBy}
      viewer={viewer}
    />
  );
}

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
  const choices = callChoices(comparison);
  const state = callState(comparison, decision);
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
          {state === 'needs-commit' ? (
            <Icon name="warning" tone="warn" size="small" />
          ) : (
            <Icon name="check" tone="add" size="small" />
          )}
          <Text variant="secondary" weight="medium">
            {decidedOption(decision)}
          </Text>
          <Text variant="caption" tone="muted">
            <DecisionPlace
              connection={owner.workspace.connection}
              decidedBy={decision.decidedBy}
            />
            {decidedWhen(decision.decidedAt)}
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
        <Box gap={2}>
          {choices.length > 0 ? (
            choices.map(({ option, implemented, effect }) => (
              <Box key={option} gap={1}>
                <Box className="flex-row flex-wrap items-center" gap={2}>
                  <Button
                    label={`Choose ${option}`}
                    accessibilityLabel={[
                      `Choose ${option}`,
                      implemented ? 'In this change' : undefined,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    variant="tonal"
                    size="sm"
                    disabled={disabled}
                    onPress={() =>
                      decide({ step, call: index, decided: true, option })
                    }
                  />
                  {implemented ? (
                    <Badge label="In this change" variant="outline" />
                  ) : null}
                </Box>
                {effect ? (
                  <Text variant="caption" tone="muted">
                    {effect}
                  </Text>
                ) : null}
              </Box>
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
          <Text variant="caption" tone="muted">
            {callDeciding(comparison)}
          </Text>
        </Box>
      )}
      {state === 'needs-commit' ? (
        <Text variant="caption" tone="warn">
          {NEEDS_A_COMMIT}
        </Text>
      ) : null}
      {problem ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
    </Box>
  );
}
