import * as React from 'react';
import {
  Select as SelectRoot,
  SelectContent as SelectContentPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectGroupLabel,
  SelectItem as SelectItemPrimitive,
  SelectItemIndicator,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from '@ui-sdk/react/select';
import { cn } from '@/shared/lib/utils';
import { pageRoot } from '@/components/ui/page-root';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';

function Select<T = string>({
  value,
  onValueChange,
  onOpenChange,
  reselect = false,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectRoot<T, false>>,
  'value' | 'onValueChange' | 'multiple' | 'defaultValue'
> & {
  value: T | null;
  onValueChange?: (value: T) => void;
  reselect?: boolean;
}) {
  const [press] = React.useState(() => ({ changed: false }));
  return (
    <SelectRoot<T, false>
      {...props}
      multiple={false}
      value={value}
      onValueChange={(next) => {
        press.changed = true;
        if (next !== null) onValueChange?.(next);
      }}
      onOpenChange={(open, details) => {
        if (open) press.changed = false;
        else if (
          reselect &&
          details.reason === 'item-press' &&
          !press.changed &&
          value !== null
        )
          onValueChange?.(value);
        onOpenChange?.(open, details);
      }}
    />
  );
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupPrimitive>) {
  return (
    <SelectGroupPrimitive
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  );
}

function SelectValue({
  className,
  ...props
}: React.ComponentProps<typeof SelectValuePrimitive>) {
  return (
    <SelectValuePrimitive
      data-slot="select-value"
      className={cn('flex flex-1 text-left', className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectTriggerPrimitive>, 'children'> & {
  size?: 'sm' | 'default';
  children?: React.ReactNode;
}) {
  return (
    <SelectTriggerPrimitive
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs/relaxed whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-7 data-[size=sm]:h-6 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none size-3.5 text-muted-foreground"
      />
    </SelectTriggerPrimitive>
  );
}

function SelectContent({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: React.ComponentProps<typeof SelectContentPrimitive>) {
  return (
    <SelectContentPrimitive
      data-slot="select-content"
      data-align-trigger={alignItemWithTrigger}
      container={pageRoot()}
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn(
        'm-0 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground!',
        className,
      )}
      {...props}
    />
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupLabel>) {
  return (
    <SelectGroupLabel
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem<T = string>({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectItemPrimitive<T>>, 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <SelectItemPrimitive<T>
      data-slot="select-item"
      className={cn(
        "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-2 text-xs/relaxed outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 gap-2 whitespace-nowrap">
        {children}
      </span>
      <SelectItemIndicator className="pointer-events-none absolute right-2 flex items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </SelectItemIndicator>
    </SelectItemPrimitive>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectSeparatorPrimitive>) {
  return (
    <SelectSeparatorPrimitive
      data-slot="select-separator"
      className={cn(
        'pointer-events-none -mx-1 my-1 h-px bg-border/50',
        className,
      )}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
