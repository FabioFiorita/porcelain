import { CheckIcon } from 'lucide-react';
import {
  CALL_DECIDING,
  NEEDS_A_COMMIT,
  callChoices,
  callDecision,
  decidedAgainstChange,
  decidedOption,
  decidedWhen,
  decisionAuthor,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { useDecideCall } from '../commands/conversations';
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
        <p className="text-caption text-muted-foreground">{CALL_DECIDING}</p>
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
        <p className="text-caption text-muted-foreground">{CALL_DECIDING}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {decision ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui"
        >
          <CheckIcon aria-hidden className="size-3.5 shrink-0 text-add-fg" />
          <span className="font-medium">
            {decidedOption(decision)}
          </span>
          <span className="text-caption text-muted-foreground">
            {decisionAuthor(decision)} ·{' '}
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
      {decision && decidedAgainstChange(comparison, decision.option) && (
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
