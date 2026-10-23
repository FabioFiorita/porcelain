import { formatForDisplay } from '@tanstack/react-hotkeys';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

export function WalkthroughDock({
  label,
  onPrevious,
  onNext,
  children,
}: {
  label: string;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-center pt-4">
      <nav
        aria-label="Walkthrough dock"
        className="pointer-events-auto flex max-w-full min-w-0 items-center gap-1 rounded-full border bg-background p-1.5 shadow-lg"
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
        <span className="min-w-0 truncate px-1.5 text-sm font-medium">
          {label}
        </span>
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
