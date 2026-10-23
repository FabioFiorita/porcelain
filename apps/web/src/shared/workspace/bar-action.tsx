import type { LucideIcon } from 'lucide-react';
import { formatForDisplay } from '@tanstack/react-hotkeys';
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
}: {
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean | undefined;
  variant?: 'ghost' | 'outline';
}) {
  return (
    <>
      {(['compact', 'full'] as const).map((mode) => (
        <Tooltip key={mode}>
          <TooltipTrigger
            render={
              <Button
                variant={variant}
                size={mode === 'compact' ? 'icon-sm' : 'sm'}
                className={
                  mode === 'compact'
                    ? '@min-3xl/pane:hidden'
                    : 'hidden @min-3xl/pane:inline-flex'
                }
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
          <TooltipContent>
            {description ?? label}
            {shortcut && <Kbd>{formatForDisplay(shortcut)}</Kbd>}
          </TooltipContent>
        </Tooltip>
      ))}
    </>
  );
}
