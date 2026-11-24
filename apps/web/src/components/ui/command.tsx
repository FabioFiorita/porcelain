import * as React from 'react';
import {
  Command as CommandPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandList as CommandListPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
} from '@ui-sdk/react/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from 'cn';

import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { SearchIcon, CheckIcon } from 'lucide-react';

const listKeys: Readonly<Record<string, string>> = {
  j: 'ArrowDown',
  n: 'ArrowDown',
  k: 'ArrowUp',
  p: 'ArrowUp',
};

function moveWithControlKeys(event: React.KeyboardEvent<HTMLElement>) {
  const arrow = listKeys[event.key];
  if (
    arrow === undefined ||
    !event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  event.target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: arrow,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function Command({
  className,
  onEscape,
  onQueryChange,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & {
  onEscape?: () => void;
}) {
  return (
    <CommandPrimitive
      onKeyDownCapture={moveWithControlKeys}
      onQueryChange={(query, details) => {
        if (details.reason === 'escape-key' && onEscape) {
          details.cancel();
          onEscape();
        } else onQueryChange?.(query, details);
      }}
      data-slot="command"
      className={cn(
        'flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          'top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0',
          className,
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! bg-input/20 dark:bg-input/30">
        <CommandInputPrimitive
          data-slot="command-input"
          className={cn(
            'w-full text-xs/relaxed outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-3.5 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      data-slot="command-list"
      className={cn(
        'no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none',
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      data-slot="command-empty"
      className={cn(
        'py-6 text-center text-xs/relaxed not-data-empty:hidden',
        className,
      )}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Omit<React.ComponentProps<typeof CommandGroupPrimitive>, 'children'> & {
  heading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <CommandGroupPrimitive
      data-slot="command-group"
      className={cn('overflow-hidden p-1 text-foreground', className)}
      {...props}
    >
      {heading !== undefined && (
        <CommandGroupLabel className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </CommandGroupLabel>
      )}
      {children}
    </CommandGroupPrimitive>
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparatorPrimitive>) {
  return (
    <CommandSeparatorPrimitive
      data-slot="command-separator"
      className={cn('-mx-1 my-1 h-px bg-border/50', className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof CommandItemPrimitive>, 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <CommandItemPrimitive
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-xs/relaxed outline-hidden select-none in-data-[slot=dialog-content]:rounded-md data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 data-highlighted:*:[svg]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandItemPrimitive>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'ml-auto text-[0.625rem] tracking-widest text-muted-foreground group-data-highlighted/command-item:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
