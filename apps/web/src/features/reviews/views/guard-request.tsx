import { useState } from 'react';
import { ShieldPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  changeAnchor,
  type ReviewRevision,
  type ReviewStep,
} from '@porcelain/client/reviews/rules';
import { InlineComposer } from './inline-composer';
import type { WalkthroughProps } from './walkthrough-props';

export function GuardRequest({
  step,
  revision,
  scope,
  context,
}: Pick<WalkthroughProps, 'scope' | 'context'> & {
  step: ReviewStep;
  revision: ReviewRevision;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t px-3 py-2">
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ShieldPlusIcon />
        Ask for a guard
      </Button>
      {open && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            Describe what should never happen again. Send feedback after posting
            to notify the connected agent.
          </p>
          <InlineComposer
            scope={scope}
            context={context}
            anchor={changeAnchor({
              base: revision.base,
              tip: revision.headOid,
            })}
            quote={`Add a lint or architecture rule for ${step.pointer.path}:${step.pointer.startLine}–${step.pointer.endLine} (${step.title}), rather than only fixing this instance. Prove the guard rejects the bad case.`}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
