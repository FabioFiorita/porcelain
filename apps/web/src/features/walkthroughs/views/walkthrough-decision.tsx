import { CheckIcon } from 'lucide-react';
import type { WalkthroughStop } from '@porcelain/client/walkthroughs/rules';
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
  const options = comparison?.columns ?? [];
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {decision ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui"
        >
          <CheckIcon aria-hidden className="size-3.5 shrink-0 text-add-fg" />
          <span className="font-medium">
            {decision.option ? `Decided: ${decision.option}` : 'Decided'}
          </span>
          <span className="text-caption text-muted-foreground">
            {decision.decidedBy.kind === 'owner'
              ? 'by the owner'
              : 'from a paired device'}{' '}
            ·{' '}
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
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 0 ? (
            options.map((option) => (
              <Button
                key={option}
                size="sm"
                variant="outline"
                disabled={disabled}
                aria-description={writeBlock}
                onClick={() =>
                  decide({ step, call: index, decided: true, option })
                }
              >
                Choose {option}
              </Button>
            ))
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              aria-description={writeBlock}
              onClick={() => decide({ step, call: index, decided: true })}
            >
              Mark decided
            </Button>
          )}
        </div>
      )}
      {(failure ?? (failed ? 'Decisions could not be read.' : undefined)) && (
        <p role="alert" className="text-caption text-destructive">
          {failure ?? 'Decisions could not be read.'}
        </p>
      )}
    </div>
  );
}
