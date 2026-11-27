import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function StepButton({
  label,
  icon,
  disabled,
  onClick,
  shortcut,
}: {
  label: string;
  shortcut?: string | undefined;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            aria-keyshortcuts={shortcut}
            aria-disabled={disabled || undefined}
            className="aria-disabled:cursor-default aria-disabled:hover:bg-transparent"
            onClick={disabled ? undefined : onClick}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
