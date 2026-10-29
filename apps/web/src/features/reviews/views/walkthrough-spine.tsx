import {
  BookOpenIcon,
  CheckIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';

export function WalkthroughSpine({
  stops,
  current,
  done,
  onGo,
  page,
}: {
  stops: readonly WalkthroughStop[];
  current: WalkthroughKey | undefined;
  done: (stop: WalkthroughStop) => boolean;
  onGo: (key: WalkthroughKey) => void;
  page: HTMLElement | null;
}) {
  const lastDone = stops.findLastIndex(done);
  const reached =
    current === undefined
      ? lastDone + 1
      : Math.max(
          stops.findIndex((stop) => stop.key === current),
          lastDone,
        );
  const [revealed, setRevealed] = useState<{
    key: WalkthroughKey;
    scrollTop: number;
    pageTop: number;
  }>();
  const reveal = (key: WalkthroughKey) => (node: HTMLElement | null) => {
    if (!node || key !== current) return;
    if (node.getClientRects().length === 0) return;
    const viewport = node.closest('[data-slot=scroll-area-viewport]');
    if (!viewport) return;
    const stop = node.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const top = Math.max(view.top, 0);
    const bottom = Math.min(view.bottom, window.innerHeight);
    const shown = stop.top >= top && stop.bottom <= bottom;
    if (
      revealed?.key === key &&
      (shown ||
        revealed.scrollTop !== viewport.scrollTop ||
        revealed.pageTop !== (page?.scrollTop ?? 0))
    )
      return;
    if (!shown)
      viewport.scrollBy({
        top: stop.top - top - (bottom - top - stop.height) / 2,
      });
    node.scrollIntoView({ block: 'nearest' });
    const pageTop = page?.scrollTop ?? 0;
    if (
      revealed?.key !== key ||
      revealed.scrollTop !== viewport.scrollTop ||
      revealed.pageTop !== pageTop
    )
      setRevealed({ key, scrollTop: viewport.scrollTop, pageTop });
  };
  return (
    <div className="sticky top-0 hidden h-fit max-h-[100cqh] w-14 shrink-0 grid-rows-[minmax(0,1fr)] border-r @2xl/review:grid @5xl/review:w-18">
      <ScrollArea className="min-h-0">
        <nav
          aria-label="Walkthrough progress"
          className="flex flex-col items-center gap-6 py-6"
        >
          {stops.map((stop, index) => (
            <div
              key={stop.key}
              ref={reveal(stop.key)}
              className="relative flex flex-col items-center"
            >
              {index < stops.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-full left-1/2 h-7 -translate-x-1/2 -translate-y-0.5',
                    index < reached
                      ? 'w-0.75 bg-brand'
                      : 'w-px bg-border-strong',
                  )}
                />
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="relative"
                      aria-label={spineLabel(stop)}
                      aria-current={stop.key === current ? 'step' : undefined}
                      onClick={() => onGo(stop.key)}
                    />
                  }
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full border border-border-strong bg-card text-muted-foreground',
                      stop.key === current &&
                        'border-brand text-brand ring-4 ring-brand-soft',
                      done(stop) &&
                        'border-brand bg-brand text-brand-foreground',
                    )}
                  >
                    <SpineMark stop={stop} done={done(stop)} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">{spineLabel(stop)}</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
function SpineMark({ stop, done }: { stop: WalkthroughStop; done: boolean }) {
  if (done) return <CheckIcon className="size-3.5" />;
  switch (stop.kind) {
    case 'briefing':
      return <BookOpenIcon className="size-3.5" />;
    case 'decision':
      return <span className="text-xs tabular-nums">{stop.number}</span>;
    case 'unexplained':
      return <FileQuestionIcon className="size-3.5 text-graph-4" />;
    case 'specs':
      return <FlaskConicalIcon className="size-3.5" />;
  }
}

function spineLabel(stop: WalkthroughStop) {
  return stop.kind === 'briefing'
    ? 'Open the briefing'
    : `Go to ${stopTitle(stop)}`;
}
