import { formatForDisplay } from '@tanstack/react-hotkeys';
import { PanelRightIcon } from 'lucide-react';
import type { ReactNode, RefCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { isSurface, type Surface } from '@/shared/workspace/search';
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
  panel,
  panelTarget,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  surface: Surface;
  open: boolean;
  onSelect: (surface: Surface) => void;
  onHide: () => void;
  onToggle: () => void;
  toggleRef: RefCallback<HTMLButtonElement>;
  panel: ReactNode;
  panelTarget: HTMLElement | null;
}) {
  const names = useSurfaceNames(scope, context);
  const toggleLabel = open ? 'Hide side panel' : 'Show side panel';
  return (
    <Tabs
      orientation="vertical"
      value={open ? surface : null}
      onValueChange={(value) => {
        if (isSurface(value)) onSelect(value);
      }}
      className="w-11 shrink-0 flex-col items-center gap-1 py-2"
    >
      <TabsList
        aria-label="Side panel"
        className="gap-1 rounded-none bg-transparent group-data-vertical/tabs:p-0"
      >
        {RAIL.map((item) => (
          <Tooltip key={item.surface}>
            <TooltipTrigger
              render={
                <TabsTrigger
                  value={item.surface}
                  aria-label={names[item.surface]}
                  aria-keyshortcuts={item.keys}
                  className="workspace-choice size-8 flex-none rounded-lg text-muted-foreground group-data-vertical/tabs:w-8 group-data-vertical/tabs:justify-center group-data-vertical/tabs:px-0 data-active:text-foreground"
                  onClick={() => {
                    if (open && surface === item.surface) onHide();
                  }}
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
              {names[item.surface]}{' '}
              <Kbd>{formatForDisplay(item.keys)}</Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={toggleRef}
              variant="ghost"
              size="icon"
              className="mt-auto text-muted-foreground"
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
      {open &&
        panelTarget &&
        createPortal(
          <TabsContent value={surface} className="h-full min-h-0">
            {panel}
          </TabsContent>,
          panelTarget,
        )}
    </Tabs>
  );
}
