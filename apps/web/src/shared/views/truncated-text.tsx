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
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  render?: ReactElement<HTMLAttributes<HTMLElement>>;
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
        'relative min-w-0 truncate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        render?.props.className,
        className,
      ),
    },
    children ?? text,
  );
  const trigger = renderTrigger?.(label, clip) ?? label;
  return (
    <Tooltip disabled={!hasText} disableHoverablePopup>
      <TooltipTrigger render={trigger}>{trigger.props.children}</TooltipTrigger>
      <TooltipContent role="tooltip" className="break-all">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
