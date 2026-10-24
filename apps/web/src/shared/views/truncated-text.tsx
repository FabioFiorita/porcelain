import {
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export function TruncatedText({
  text,
  children,
  className,
  render,
  renderTrigger,
  propagateEscape = false,
  lines = 1,
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  render?: ReactElement<HTMLAttributes<HTMLElement>>;
  propagateEscape?: boolean;
  lines?: 1 | 3;
  renderTrigger?: (
    label: ReactElement,
    clip: (value: string, className?: string) => ReactElement,
  ) => ReactElement<{ children?: ReactNode }>;
}) {
  const hasText = text.trim() !== '';
  const element = render ?? <span />;
  const clip = (value: string, styles?: string) => (
    <span className={cn('min-w-0 truncate', styles)} aria-label={value}>
      {value}
    </span>
  );
  const focusIndex = hasText ? 0 : -1;
  const label: ReactElement<HTMLAttributes<HTMLElement>> = cloneElement(
    element,
    {
      tabIndex: renderTrigger ? undefined : focusIndex,
      'aria-label': text,
      className: cn(
        'relative min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        lines === 3 ? 'line-clamp-3 whitespace-normal' : 'truncate',
        render?.props.className,
        className,
      ),
    },
    children ?? text,
  );
  const trigger = renderTrigger?.(label, clip) ?? label;
  return (
    <Tooltip
      disabled={!hasText}
      disableHoverablePopup
      onOpenChange={(_open, details) => {
        if (propagateEscape && details.reason === 'escape-key')
          details.allowPropagation();
      }}
    >
      <TooltipTrigger render={trigger}>{trigger.props.children}</TooltipTrigger>
      <TooltipContent role="tooltip" className="break-all">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
