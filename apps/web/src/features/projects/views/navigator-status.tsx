import { useId, useState } from 'react';
import { CircleIcon, CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import {
  reviewListMeta,
  reviewListSignal,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const quiet = (
  <CircleIcon
    aria-hidden
    strokeWidth={3.5}
    className="size-2.5 text-border-strong"
  />
);

const glyphs = {
  Projects: quiet,
  'No review': quiet,
  'Needs you': <span aria-hidden className="size-2 rounded-full bg-brand" />,
  'Waiting on agent': (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      fill="none"
      strokeWidth={1.5}
      className="size-3 text-muted-foreground"
    >
      <circle
        cx="6"
        cy="6"
        r="4.75"
        stroke="currentColor"
        strokeDasharray="2 2"
      />
      <path
        d="M6 1.25A4.75 4.75 0 0 1 10.75 6"
        strokeLinecap="round"
        className="stroke-foreground"
      />
    </svg>
  ),
  'Ready to merge': (
    <CircleCheckIcon
      aria-hidden
      className="size-3.5 fill-foreground text-background"
    />
  ),
  Closed: <CircleIcon aria-hidden className="size-3 text-muted-foreground" />,
};

export function NavigatorStatus({ entry }: { entry: ReviewListEntry }) {
  const [visibility, setVisibility] = useState<'preview' | 'pressed'>();
  const open = visibility !== undefined;
  const id = useId();
  const reasonId = `${id}-reason`;
  const signal = reviewListSignal(entry);
  if (!signal)
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center">
        {quiet}
      </span>
    );
  const indicator =
    signal.tone === 'destructive' ? (
      <CircleAlertIcon aria-hidden className="size-3.5 text-destructive" />
    ) : (
      glyphs[entry.group]
    );
  return (
    <Tooltip
      open={open}
      onOpenChange={(next, details) =>
        setVisibility((current) => {
          if (current === 'pressed' && details.reason === 'trigger-hover')
            return current;
          return next ? 'preview' : undefined;
        })
      }
      triggerId={id}
    >
      <TooltipTrigger
        id={id}
        closeOnClick={false}
        aria-describedby={open ? reasonId : undefined}
        onClick={() => setVisibility('pressed')}
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            aria-label={`Review status: ${entry.title}`}
          />
        }
      >
        {indicator}
      </TooltipTrigger>
      <TooltipContent id={reasonId} side="right" role="tooltip">
        <div>
          <p>{entry.title}</p>
          <p>{reviewListMeta(entry, Date.now())}</p>
          {entry.badges.length ? (
            entry.badges.map((badge) => <p key={badge.label}>{badge.label}</p>)
          ) : (
            <p>{signal.reason}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
