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
  const choose =
    choices.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <ul
          aria-label="Options"
          className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 @xl:grid-cols-[minmax(0,auto)_minmax(16rem,1fr)]"
        >
          {choices.map(({ option, implemented, effect }) => (
            <li
              key={option}
              className="col-span-full grid grid-cols-subgrid items-center gap-y-1"
            >
              <Button
                size="sm"
                variant="outline"
                className="h-auto min-h-6 max-w-full justify-self-start text-left whitespace-normal"
                disabled={disabled}
                aria-description={
                  [
                    implemented ? 'In this change.' : undefined,
                    effect,
                    writeBlock,
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={() =>
                  decide({ step, call: index, decided: true, option })
                }
              >
                {option}
              </Button>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                {implemented && <Badge variant="outline">In this change</Badge>}
                {effect && (
                  <span className="text-caption text-pretty text-muted-foreground">
                    {effect}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-muted-foreground">
          {callDeciding(comparison)}
        </p>
      </div>
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
    <div className="flex flex-col gap-1.5 pt-1">
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
