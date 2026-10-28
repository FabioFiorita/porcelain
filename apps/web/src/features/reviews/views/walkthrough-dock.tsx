import { TruncatedText } from '@/shared/views/truncated-text';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { quietButton } from './review-controls';

export function WalkthroughDock({
  label,
  shortLabel,
  compactLabel,
  stops,
  current,
  onGo,
  onPrevious,
  onNext,
  children,
}: {
  label: string;
  shortLabel: string;
  compactLabel: string;
  stops: readonly WalkthroughStop[];
  current: WalkthroughKey;
  onGo: (key: WalkthroughKey) => void;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-center pt-4">
      <nav
        aria-label="Walkthrough dock"
        className="pointer-events-auto flex max-w-full min-w-0 items-center gap-0 rounded-full border bg-background p-1 @md/review:gap-1 @md/review:p-1.5 shadow-lg"
      >
        <DockStep
          label="Previous stop"
          keys={SHORTCUTS.previousStop}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
        </DockStep>
        <DockStep label="Next stop" keys={SHORTCUTS.nextStop} onClick={onNext}>
          <ChevronRightIcon />
        </DockStep>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={`${quietButton} h-7 min-w-0 shrink-0 gap-1 px-2.5 text-ui leading-4 aria-expanded:bg-muted @md/review:shrink [&_svg]:size-3.5`}
                aria-label={`${label}, jump to a stop`}
              />
            }
          >
            <TruncatedText
              className="min-w-0 tabular-nums"
              text={`${label}, jump to a stop`}
            >
              <span className="@md/review:hidden">{compactLabel}</span>
              <span className="hidden @md/review:inline @2xl/review:hidden">
                {shortLabel}
              </span>
              <span className="hidden @2xl/review:inline">{label}</span>
            </TruncatedText>
            <ChevronDownIcon
              className="hidden @md/review:block"
              data-icon="inline-end"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            {stops.map((stop) => (
              <DropdownMenuItem
                key={stop.key}
                aria-current={stop.key === current ? 'step' : undefined}
                onClick={() => onGo(stop.key)}
              >
                {stop.kind === 'briefing'
                  ? 'Open the briefing'
                  : stopTitle(stop)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <KbdGroup className="mr-1.5 hidden @2xl/review:inline-flex">
          <Kbd>{formatForDisplay(SHORTCUTS.previousStop)}</Kbd>
          <Kbd>{formatForDisplay(SHORTCUTS.nextStop)}</Kbd>
        </KbdGroup>
        {children}
      </nav>
    </div>
  );
}

function DockStep({
  label,
  keys,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  onClick: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={!onClick}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <Kbd>{formatForDisplay(keys)}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
