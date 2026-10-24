import type { ComponentProps } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function FullValueTooltip({
  value,
  children = value,
  ...props
}: ComponentProps<typeof TooltipTrigger> & { value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        aria-label={value}
        {...props}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent role="tooltip" className="wrap-anywhere">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}
