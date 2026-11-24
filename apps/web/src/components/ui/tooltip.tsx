import * as React from 'react';
import {
  Tooltip as TooltipRoot,
  TooltipArrow,
  TooltipContent as TooltipContentPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from '@ui-sdk/react/tooltip';
import { cn } from 'cn';

type TooltipPointer = {
  silence: (silent: boolean) => void;
  away: (away: boolean) => void;
  pressed: (pressed: boolean) => void;
  pressing: boolean;
  hoverable: boolean;
};

const TooltipPointerContext = React.createContext<TooltipPointer>({
  silence: () => {},
  away: () => {},
  pressed: () => {},
  pressing: false,
  hoverable: true,
});

function Tooltip({
  delay = 400,
  type = 'description',
  disabled = false,
  hoverable = true,
  ...props
}: React.ComponentProps<typeof TooltipRoot> & { hoverable?: boolean }) {
  const [silent, setSilent] = React.useState(false);
  const [pressing, setPressing] = React.useState(false);
  const [pointerAway, setPointerAway] = React.useState(false);
  return (
    <TooltipPointerContext
      value={{
        silence: setSilent,
        away: setPointerAway,
        pressed: setPressing,
        pressing,
        hoverable,
      }}
    >
      <TooltipRoot
        delay={delay}
        type={type}
        disabled={disabled || silent}
        {...props}
        {...(silent || (pointerAway && !hoverable) ? { open: false } : {})}
      />
    </TooltipPointerContext>
  );
}

function TooltipTrigger({
  render,
  onContextMenu,
  onPointerEnter,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onFocus,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<typeof TooltipTriggerPrimitive>, 'render'> & {
  render?:
    | React.ComponentProps<typeof TooltipTriggerPrimitive>['render']
    | undefined;
}) {
  const { silence, away, pressed } = React.use(TooltipPointerContext);
  return (
    <TooltipTriggerPrimitive
      data-slot="tooltip-trigger"
      {...(render === undefined ? {} : { render })}
      onContextMenu={(event) => {
        silence(true);
        onContextMenu?.(event);
      }}
      onPointerEnter={(event) => {
        away(false);
        onPointerEnter?.(event);
      }}
      onPointerDown={(event) => {
        pressed(true);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        pressed(false);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        pressed(false);
        onPointerCancel?.(event);
      }}
      onPointerLeave={(event) => {
        pressed(false);
        away(true);
        silence(false);
        onPointerLeave?.(event);
      }}
      onFocus={(event) => {
        away(false);
        onFocus?.(event);
      }}
      onKeyDown={(event) => {
        if (
          event.key !== 'ContextMenu' &&
          !(event.shiftKey && event.key === 'F10')
        )
          silence(false);
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TooltipContentPrimitive>, 'children'> & {
  children?: React.ReactNode;
}) {
  const { pressing, hoverable } = React.use(TooltipPointerContext);
  return (
    <TooltipContentPrimitive
      data-slot="tooltip-content"
      data-pass-through={pressing || !hoverable ? '' : undefined}
      container={typeof document === 'undefined' ? null : document.body}
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className={cn(
        'not-data-[side]:pointer-events-none data-closed:pointer-events-none data-pass-through:pointer-events-none m-0 inline-flex overflow-visible empty:hidden w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        className,
      )}
      {...props}
    >
      {(state) =>
        state.open && (
          <>
            {children}
            <TooltipArrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
          </>
        )
      }
    </TooltipContentPrimitive>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
