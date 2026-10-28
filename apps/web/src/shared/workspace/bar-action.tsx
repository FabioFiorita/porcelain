import type { LucideIcon } from 'lucide-react';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function BarAction({
  label,
  description,
  icon: Icon,
  shortcut,
  onClick,
  disabled = false,
  pressed,
  variant = 'ghost',
  iconOnly = false,
}: {
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean | undefined;
  variant?: 'ghost' | 'outline';
  iconOnly?: boolean;
}) {
  return (
    <>
      {(iconOnly ? (['compact'] as const) : (['compact', 'full'] as const)).map(
        (mode) => (
          <Tooltip key={mode}>
            <TooltipTrigger
              render={
                <Button
                  variant={variant}
                  size={mode === 'compact' ? 'icon-sm' : 'xs'}
                  className={cn(
                    !iconOnly && mode === 'compact' && '@min-3xl/pane:hidden',
                    mode === 'full' && 'hidden h-7 @min-3xl/pane:inline-flex',
                  )}
                  aria-label={label}
                  aria-keyshortcuts={shortcut}
                  aria-pressed={pressed}
                  disabled={disabled}
                  focusableWhenDisabled
                  onClick={onClick}
                />
              }
            >
              <Icon className="size-3.5" />
              {mode === 'full' && (
                <>
                  <span>{label}</span>
                  {shortcut && <Kbd>{formatForDisplay(shortcut)}</Kbd>}
                </>
              )}
            </TooltipTrigger>
            <TooltipContent role="tooltip">
              {description ?? label}
              {shortcut && <Kbd>{formatForDisplay(shortcut)}</Kbd>}
            </TooltipContent>
          </Tooltip>
        ),
      )}
    </>
  );
}
