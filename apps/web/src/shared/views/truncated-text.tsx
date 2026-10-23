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
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  render?: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const hasText = text.trim() !== '';
  const element = render ?? <span />;
  return (
    <Tooltip disabled={!hasText}>
      <TooltipTrigger
        render={cloneElement(element, {
          tabIndex: hasText ? 0 : -1,
          'aria-label': text,
          className: cn(
            'relative min-w-0 truncate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            render?.props.className,
            className,
          ),
        })}
      >
        {children ?? text}
      </TooltipTrigger>
      <TooltipContent role="tooltip" className="break-all">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
