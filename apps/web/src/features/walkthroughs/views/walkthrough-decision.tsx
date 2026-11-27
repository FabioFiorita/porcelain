import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import {
  NEEDS_A_COMMIT,
  callChoices,
  callDecision,
  callDeciding,
  callState,
  decidedOption,
  decidedWhen,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
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
  const decision = callDecision(view?.decisions, step, index);
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
          <span className="font-medium">{decidedOption(decision)}</span>
          <time
            dateTime={decision.decidedAt}
            className="text-caption text-muted-foreground"
          >
            {decidedWhen(decision.decidedAt)}
          </time>
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
