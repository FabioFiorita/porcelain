import { detectPlatform, formatForDisplay } from '@tanstack/react-hotkeys';
import { PanelLeft, PanelRight } from 'lucide-react';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  ref?: Ref<HTMLButtonElement>;
  side: 'left' | 'right';
  /** The panel's name ("Projects"); `aria-expanded` says whether it is showing. */
  label: string;
  expanded: boolean;
  /** At narrow widths the panel opens as a slide-over, which is a dialog. */
  overlay: boolean;
  shortcut: string;
  onToggle: () => void;
};

/** `aria-keyshortcuts` wants real key names, not TanStack's `Mod`. */
const ariaKeys = (shortcut: string) =>
  shortcut.replace('Mod', detectPlatform() === 'mac' ? 'Meta' : 'Control');

/** Shows or hides a side panel: the projects navigator on the left, the review sidebar on the right. */
export function PanelToggle({
  ref,
  side,
  label,
  expanded,
  overlay,
  shortcut,
  onToggle,
}: Props) {
  const Icon = side === 'left' ? PanelLeft : PanelRight;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={ref}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={label}
            aria-expanded={expanded}
            aria-haspopup={overlay ? 'dialog' : undefined}
            aria-keyshortcuts={ariaKeys(shortcut)}
            onClick={onToggle}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {expanded ? 'Hide' : 'Show'} {label.toLowerCase()}
        <Kbd>{formatForDisplay(shortcut)}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
