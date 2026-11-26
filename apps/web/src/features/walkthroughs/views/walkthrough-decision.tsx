import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import { readDeviceLabels, readViewer } from '@porcelain/client/access';
import {
  NEEDS_A_COMMIT,
  callChoices,
  callDeciding,
  callState,
  decisionPlace,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import type { Connection } from '@/shared/workspace/connection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { useDecideCall } from '../commands/conversations';
import { ComparisonTable } from './walkthrough-blocks';
import {
  useConversations,
  type ConversationScope,
} from '../queries/conversations';

type Comparison = WalkthroughStop['callouts'][number]['comparison'];

function decidedWhen(at: string) {
  return new Date(at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type Decider = { kind: 'owner' } | { kind: 'device'; deviceId: string };

function DeviceLabels({
  connection,
  decidedBy,
  viewer,
}: {
  connection: Connection;
  decidedBy: Decider;
  viewer: Decider | undefined;
}) {
  const result = useAtomValue(readDeviceLabels(connection));
  if (AsyncResult.isInitial(result)) return null;
  const labels = Option.getOrUndefined(AsyncResult.value(result));
  const place = decisionPlace(decidedBy, viewer, labels);
  return place ? <>{place} · </> : null;
}

function DecisionPlace({
  connection,
  decidedBy,
}: {
  connection: Connection;
  decidedBy: Decider;
}) {
  const viewer = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readViewer(connection))),
  );
  const place = decisionPlace(decidedBy, viewer, undefined);
  if (place === undefined) return null;
  if (decidedBy.kind === 'owner') return <>{place} · </>;
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
  owner: ConversationScope;
  step: number;
  index: number;
  comparison: Comparison;
}) {
  const { view, failed } = useConversations(owner);
  const { decide, waiting, failure } = useDecideCall(owner);
  const writeBlock = useWorkspaceWriteBlock(owner.context);
  const disabled = waiting || Boolean(writeBlock) || view === undefined;
  const decision = view?.decisions.find(
    (entry) => entry.step === step && entry.call === index,
  );
  const choices = callChoices(comparison);
  const state = callState(comparison, decision);
  const byOption = new Map(choices.map((choice) => [choice.option, choice]));
  const chooseOption = (option: string) => {
    const choice = byOption.get(option);
    if (choice === undefined) return null;
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={`Choose ${option}`}
          aria-description={
            [
              choice.implemented ? 'In this change.' : undefined,
              choice.effect,
              writeBlock,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onClick={() => decide({ step, call: index, decided: true, option })}
        >
          Choose
        </Button>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {choice.implemented && (
            <Badge variant="outline">In this change</Badge>
          )}
          {choice.effect && (
            <span className="text-caption text-pretty text-muted-foreground">
              {choice.effect}
            </span>
          )}
        </span>
      </div>
    );
  };
  const choose =
    choices.length > 0 ? (
      <p className="text-caption text-muted-foreground">
        {callDeciding(comparison)}
      </p>
    ) : (
      <div className="flex flex-col gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={disabled}
          aria-description={writeBlock}
          onClick={() => decide({ step, call: index, decided: true })}
        >
          Mark decided
        </Button>
        <p className="text-caption text-muted-foreground">
          {callDeciding(comparison)}
        </p>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {comparison && (
        <ComparisonTable
          comparison={comparison}
          choose={decision ? undefined : chooseOption}
        />
      )}
      {decision ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui"
        >
          {state === 'needs-commit' ? (
            <CircleAlertIcon
              aria-hidden
              className="size-3.5 shrink-0 text-warn"
            />
          ) : (
            <CheckIcon aria-hidden className="size-3.5 shrink-0 text-add-fg" />
          )}
          <span className="font-medium">
            {decision.option ? `Decided: ${decision.option}` : 'Decided'}
          </span>
          <span className="text-caption text-muted-foreground">
            <DecisionPlace
              connection={owner.context.connection}
              decidedBy={decision.decidedBy}
            />
            <time dateTime={decision.decidedAt}>
              {decidedWhen(decision.decidedAt)}
            </time>
          </span>
          <Button
            variant="link"
            size="sm"
            disabled={disabled}
            aria-description={writeBlock}
            onClick={() => decide({ step, call: index, decided: false })}
          >
            Undo
          </Button>
        </p>
      ) : (
        choose
      )}
      {state === 'needs-commit' && (
        <p className="text-caption text-warn">{NEEDS_A_COMMIT}</p>
      )}
      {(failure ?? (failed ? 'Decisions could not be read.' : undefined)) && (
        <p role="alert" className="text-caption text-destructive">
          {failure ?? 'Decisions could not be read.'}
        </p>
      )}
    </div>
  );
}
