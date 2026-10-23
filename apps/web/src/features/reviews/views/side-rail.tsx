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
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { Surface } from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { SurfaceIcon, useSurfaceNames } from './review-sidebar';

const RAIL: readonly { surface: Surface; keys: string }[] = [
  { surface: 'files', keys: SHORTCUTS.surfaceFiles },
  { surface: 'changes', keys: SHORTCUTS.surfaceReview },
  { surface: 'history', keys: SHORTCUTS.surfaceHistory },
];

export function SideRail({
  scope,
  context,
  surface,
  open,
  onSelect,
  onHide,
  onToggle,
  toggleRef,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  surface: Surface;
  open: boolean;
  onSelect: (surface: Surface) => void;
  onHide: () => void;
  onToggle: () => void;
  toggleRef: RefCallback<HTMLButtonElement>;
}) {
  const names = useSurfaceNames(scope, context);
  const toggleLabel = open ? 'Hide side panel' : 'Show side panel';
  return (
    <nav
      aria-label="Side panel"
      className="flex w-11 shrink-0 flex-col items-center gap-1 pt-2.5 pb-2 pl-1 text-muted-foreground"
    >
      {RAIL.map((item) => {
        const selected = open && surface === item.surface;
        return (
          <span
            key={item.surface}
            data-selected={selected || undefined}
            className="workspace-choice inline-flex rounded-lg data-selected:text-foreground"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={names[item.surface]}
                    aria-pressed={selected}
                    aria-keyshortcuts={item.keys}
                    onClick={() =>
                      selected ? onHide() : onSelect(item.surface)
                    }
                  />
                }
              >
                <SurfaceIcon
                  scope={scope}
                  context={context}
                  surface={item.surface}
                />
              </TooltipTrigger>
              <TooltipContent side="left">
                {names[item.surface]} <Kbd>{formatForDisplay(item.keys)}</Kbd>
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
