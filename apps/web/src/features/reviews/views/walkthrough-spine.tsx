import {
  BookOpenIcon,
  CheckIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/components/ui/button';
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
}: {
  stops: readonly WalkthroughStop[];
  current: WalkthroughKey | undefined;
  done: (stop: WalkthroughStop) => boolean;
  onGo: (key: WalkthroughKey) => void;
}) {
  return (
    <nav
      aria-label="Walkthrough progress"
      className="sticky top-0 hidden h-fit w-14 shrink-0 flex-col items-center gap-6 border-r py-6 @2xl/review:flex @5xl/review:w-18"
    >
      {stops.map((stop, index) => (
        <div key={stop.key} className="relative flex flex-col items-center">
          {index < stops.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-full left-1/2 h-6 w-px',
                done(stop) ? 'bg-brand' : 'bg-border',
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
                  'grid size-6 place-items-center rounded-full border bg-card',
                  stop.key === current &&
                    'border-brand text-brand ring-4 ring-brand-soft',
                  done(stop) && 'border-brand bg-brand text-brand-foreground',
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
