import { formatForDisplay } from '@tanstack/react-hotkeys';
import { PanelRightIcon } from 'lucide-react';
import type { RefCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Surface } from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { SurfaceIcon } from './review-sidebar';

const KEYS: Record<Surface, string> = {
  files: SHORTCUTS.surfaceFiles,
  changes: SHORTCUTS.surfaceReview,
  history: SHORTCUTS.surfaceHistory,
};

export function SideRail({
  surfaces,
  names,
  published,
  surface,
  open,
  onSelect,
  onHide,
  onToggle,
  toggleRef,
}: {
  surfaces: readonly Surface[];
  names: Record<Surface, string>;
  published: boolean;
  surface: Surface;
  open: boolean;
  onSelect: (surface: Surface) => void;
  onHide: () => void;
  onToggle: () => void;
  toggleRef: RefCallback<HTMLButtonElement>;
}) {
  const toggleLabel = open ? 'Hide side panel' : 'Show side panel';
  return (
    <nav
      aria-label="Side panel"
      className="flex w-11 shrink-0 flex-col items-center gap-1 pt-2.5 pb-2 pl-1 text-muted-foreground"
    >
      {surfaces.map((item) => {
        const selected = open && surface === item;
        return (
          <span
            key={item}
            data-selected={selected || undefined}
            className="workspace-choice inline-flex rounded-lg data-selected:text-foreground"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={names[item]}
                    aria-pressed={selected}
                    aria-keyshortcuts={KEYS[item]}
                    onClick={() => (selected ? onHide() : onSelect(item))}
                  />
                }
              >
                <SurfaceIcon published={published} surface={item} />
              </TooltipTrigger>
              <TooltipContent side="left">
                {names[item]} <Kbd>{formatForDisplay(KEYS[item])}</Kbd>
              </TooltipContent>
            </Tooltip>
          </span>
        );
      })}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={toggleRef}
              variant="ghost"
              size="icon"
              className="mt-auto"
              aria-label={toggleLabel}
              aria-expanded={open}
              aria-keyshortcuts={SHORTCUTS.toggleSidebar}
              onClick={onToggle}
            />
          }
        >
          <PanelRightIcon />
        </TooltipTrigger>
        <TooltipContent side="left">
          {toggleLabel} <Kbd>{formatForDisplay(SHORTCUTS.toggleSidebar)}</Kbd>
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}
