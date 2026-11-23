import * as React from 'react';
import { MenuContent, MenuContextTrigger } from '@ui-sdk/react/menu';
import { cn } from 'cn';
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  menuContentClassName,
} from '@/components/ui/dropdown-menu';

function ContextMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof MenuContextTrigger>) {
  return (
    <MenuContextTrigger
      data-slot="context-menu-trigger"
      className={cn('select-none', className)}
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuContent>) {
  return (
    <MenuContent
      data-slot="context-menu-content"
      className={cn(menuContentClassName, className)}
      {...props}
    />
  );
}

export {
  DropdownMenu as ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuShortcut as ContextMenuShortcut,
};
