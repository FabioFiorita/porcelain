import { useState } from 'react';
import { AsyncResult } from 'effect/reactivity';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type {
  WalkthroughEvidence,
  WalkthroughRun,
  WalkthroughScreenshot,
} from '@porcelain/client/walkthroughs/rules';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PendingSpinner, StateNotice } from '@/shared/views/state-notice';
import { useWalkthroughAssetUrl } from '../queries/walkthrough';
import { RichText } from './rich-text';
import { StepButton } from './step-button';

type EvidenceProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  run: WalkthroughRun;
  items: readonly WalkthroughScreenshot[];
};

function EvidenceImage({
  scope,
  context,
  run,
  item,
  className,
  opened = false,
}: Omit<EvidenceProps, 'items'> & {
  item: WalkthroughEvidence;
  className: string;
  opened?: boolean;
}) {
  const { url, retry } = useWalkthroughAssetUrl({
    scope,
    context,
    runId: run.id,
    assetId: item.assetId,
  });
  if (AsyncResult.isSuccess(url))
    return (
      <img
        src={url.value}
        alt=""
        loading="lazy"
        decoding="async"
        className={className}
      />
    );
  if (!opened) return null;
  if (AsyncResult.isFailure(url) && !url.waiting)
    return (
      <StateNotice
        role="alert"
        message="This screenshot could not be loaded."
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        }
      />
    );
  return (
    <div className="grid min-h-48 place-items-center">
      <PendingSpinner label="Reading the screenshot" />
    </div>
  );
}

export function WalkthroughProof({
  scope,
  context,
  run,
  items,
}: EvidenceProps) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = open === null ? undefined : items[open];
  return (
    <>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 @3xl:-mx-0 @3xl:px-0">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            aria-label={item.enlarge}
            onClick={() => setOpen(index)}
            className="group flex w-34 shrink-0 flex-col gap-1.5 text-left"
          >
            <EvidenceImage
              scope={scope}
              context={context}
              run={run}
              item={item}
              className="h-56 w-full rounded-lg border object-cover object-top transition-opacity group-hover:opacity-85"
            />
            <span className="line-clamp-3 text-caption leading-4 text-muted-foreground">
              <span className="font-medium text-foreground">{item.label}</span>{' '}
              <RichText text={item.shows} />
            </span>
          </button>
        ))}
      </div>
      <Dialog
        open={shown !== undefined}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-[min(92vw,52rem)]">
          <DialogTitle>
            {shown && (
              <>
                {shown.label} · <RichText text={shown.shows} />
              </>
            )}
          </DialogTitle>
          {shown && (
            <EvidenceImage
              scope={scope}
              context={context}
              run={run}
              item={shown}
              className="mx-auto max-h-[72vh] rounded-lg border"
              opened
            />
          )}
          {items.length > 1 && open !== null && (
            <div className="flex items-center justify-center gap-3 text-caption text-muted-foreground">
              <StepButton
                label="Previous screenshot"
                icon={<ChevronLeftIcon />}
                disabled={open === 0}
                onClick={() => setOpen(open - 1)}
              />
              {open + 1} of {items.length}
              <StepButton
                label="Next screenshot"
                icon={<ChevronRightIcon />}
                disabled={open === items.length - 1}
                onClick={() => setOpen(open + 1)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
