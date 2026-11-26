import { useState, type CSSProperties } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingSpinner, StateNotice } from '@/shared/views/state-notice';
import { useWalkthroughAssetUrl } from '../queries/walkthrough';
import { RichText } from './rich-text';
import { StepButton } from './step-button';
import { EvidenceBox } from './evidence-box';

type EvidenceProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  run: WalkthroughRun;
  items: readonly WalkthroughScreenshot[];
};

type Source = Omit<EvidenceProps, 'items'>;

function EvidenceImage({
  scope,
  context,
  run,
  item,
  className,
  style,
  opened = false,
  framed = true,
}: Source & {
  item: WalkthroughEvidence;
  className: string;
  style?: CSSProperties;
  opened?: boolean;
  framed?: boolean;
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
        style={style}
      />
    );
  const failed = AsyncResult.isFailure(url) && !url.waiting;
  if (!opened)
    return framed ? (
      <span
        role={failed ? 'alert' : undefined}
        className="grid aspect-video w-full place-items-center rounded-sm border bg-muted px-3 text-center text-caption text-muted-foreground"
      >
        {failed ? (
          'This screenshot could not be loaded.'
        ) : (
          <PendingSpinner label="Reading the screenshot" />
        )}
      </span>
    ) : null;
  if (failed)
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

function Caption({ item }: { item: WalkthroughScreenshot }) {
  return (
    <span className="text-caption text-muted-foreground">
      <span className="font-medium text-foreground">{item.label}</span>{' '}
      <RichText text={item.shows} />
    </span>
  );
}

function SideBySide({
  source,
  items,
  onEnlarge,
}: {
  source: Source;
  items: readonly WalkthroughScreenshot[];
  onEnlarge: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          aria-label={item.enlarge}
          onClick={() => onEnlarge(index)}
          className="group flex min-w-0 flex-col gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <EvidenceImage
            {...source}
            item={item}
            className="max-h-80 w-auto max-w-full self-start rounded-sm border group-hover:opacity-90"
          />
          <Caption item={item} />
        </button>
      ))}
    </div>
  );
}

function Overlay({
  source,
  before,
  after,
}: {
  source: Source;
  before: WalkthroughScreenshot;
  after: WalkthroughScreenshot;
}) {
  const [split, setSplit] = useState(50);
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="relative mx-auto w-full max-w-56 overflow-hidden rounded-sm border bg-muted">
        <EvidenceImage {...source} item={before} className="block w-full" />
        <EvidenceImage
          {...source}
          item={after}
          framed={false}
          className="absolute inset-0 size-full object-contain object-left-top"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-foreground/60"
          style={{ left: `${split}%` }}
        />
      </div>
      <div className="mx-auto flex w-full max-w-sm items-center gap-3 text-caption text-muted-foreground">
        <span>Before</span>
        <Slider
          value={split}
          onValueChange={(next) =>
            setSplit(typeof next === 'number' ? next : 50)
          }
          thumbLabel="Divide before and after"
        />
        <span>After</span>
      </div>
      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
        <Caption item={before} />
        <Caption item={after} />
      </div>
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
  const [mode, setMode] = useState<'side' | 'overlay'>('side');
  const shown = open === null ? undefined : items[open];
  const source = { scope, context, run };
  const [before, after] = items;
  return (
    <>
      <EvidenceBox
        label="Before and after"
        heading={
          <>
            <span className="flex-1">Before and after</span>
            {before && after && (
              <Tabs
                value={mode}
                onValueChange={(next: unknown) =>
                  setMode(next === 'overlay' ? 'overlay' : 'side')
                }
              >
                <TabsList aria-label="Compare" className="h-6!">
                  <TabsTrigger value="side">Side by side</TabsTrigger>
                  <TabsTrigger value="overlay">Slider</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </>
        }
      >
        {mode === 'overlay' && before && after ? (
          <Overlay source={source} before={before} after={after} />
        ) : (
          <SideBySide source={source} items={items} onEnlarge={setOpen} />
        )}
      </EvidenceBox>
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
              {...source}
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
