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

export function NavigatorStatus({ entry }: { entry: ReviewListEntry }) {
  const [visibility, setVisibility] = useState<'preview' | 'pressed'>();
  const open = visibility !== undefined;
  const id = useId();
  const reasonId = `${id}-reason`;
  const signal = reviewListSignal(entry);
  if (!signal)
    return (
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground"
        aria-hidden
      >
        <CircleIcon className="size-3" />
      </span>
    );
  const indicator = {
    destructive: { Icon: CircleAlertIcon, className: 'text-destructive' },
    primary: { Icon: CircleCheckIcon, className: 'text-primary' },
    muted: { Icon: CircleIcon, className: 'text-muted-foreground' },
  }[signal.tone];
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
            size="icon-sm"
            aria-label={`Review status: ${entry.title}`}
          />
        }
      >
        <indicator.Icon aria-hidden className={indicator.className} />
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
