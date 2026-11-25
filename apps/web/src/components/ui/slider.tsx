import type * as React from 'react';
import {
  Slider as SliderRoot,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from '@ui-sdk/react/slider';
import { cn } from 'cn';

function Slider({
  className,
  thumbLabel,
  ...props
}: Omit<React.ComponentProps<typeof SliderRoot>, 'className'> & {
  className?: string | undefined;
  thumbLabel: string;
}) {
  return (
    <SliderRoot
      data-slot="slider"
      className={cn('w-full touch-none select-none', className)}
      {...props}
    >
      <SliderControl className="flex h-5 w-full items-center">
        <SliderTrack className="relative h-1 w-full rounded-full bg-muted">
          <SliderIndicator className="h-full rounded-full bg-border-strong" />
          <SliderThumb
            aria-label={thumbLabel}
            className="size-3.5 rounded-full border border-border-strong bg-background shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  );
}

export { Slider };
