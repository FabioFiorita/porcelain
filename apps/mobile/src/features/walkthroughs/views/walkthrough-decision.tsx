import { Fragment } from 'react';
import { useAtomValue } from '@effect/atom-react';
import { readDecisionPlace } from '@porcelain/client/walkthroughs';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  NEEDS_A_COMMIT,
  callChoices,
  callDeciding,
  callDecision,
  callState,
  decidedOption,
  decidedWhen,
  type WalkthroughComparison,
} from '@porcelain/client/walkthroughs/rules';
import { Badge } from '../../../components/ui/badge';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import { useDecideCall } from '../commands/conversations';
import { ComparisonTable } from './walkthrough-blocks';
import {
  useConversations,
  type ConversationOwner,
} from '../queries/conversations';

function DecisionPlace({
  connection,
  decidedBy,
}: {
  connection: RuntimeConnection;
  decidedBy: Parameters<typeof readDecisionPlace>[0]['decidedBy'];
}) {
  const place = useAtomValue(readDecisionPlace({ connection, decidedBy }));
  return place ? `${place} · ` : null;
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
      {comparison ? (
        <ComparisonTable
          comparison={comparison}
          actions={
            decision
              ? undefined
              : choices.map(({ option, implemented, effect }) => (
                  <Fragment key={option}>
                    <Button
                      label="Choose"
                      accessibilityLabel={[
                        `Choose ${option}`,
                        implemented ? 'In this change' : undefined,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      variant="tonal"
                      size="sm"
                      className="self-start"
                      disabled={disabled}
                      onPress={() =>
                        decide({ step, call: index, decided: true, option })
                      }
                    />
                    {implemented ? (
                      <Badge label="In this change" variant="outline" />
                    ) : null}
                    {effect ? (
                      <Text variant="caption" tone="muted">
                        {effect}
                      </Text>
                    ) : null}
                  </Fragment>
                ))
          }
        />
      ) : null}
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
          {choices.length > 0 ? null : (
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
