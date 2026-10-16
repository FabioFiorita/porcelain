import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { SidebarGroupLabel, SidebarMenuSub } from '@/components/ui/sidebar';
import { useGroupOpen } from '../store';

export function MachineSection({
  environmentId,
  name,
  icon: Icon,
  status,
  onOpenSettings,
  children,
}: {
  environmentId: string | null;
  name: string;
  icon: LucideIcon;
  status?: ReactNode;
  onOpenSettings?: () => void;
  children: ReactNode;
}) {
  const { open, setOpen } = useGroupOpen(
    `computer:${environmentId ?? 'local'}`,
  );
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      role="group"
      aria-label={name}
      className="group/machine mb-2"
    >
      <ContextMenu>
        <ContextMenuTrigger render={<div />}>
          <SidebarGroupLabel render={<CollapsibleTrigger />} className="w-full">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <ChevronRightIcon className="size-3.5 shrink-0 transition-transform motion-reduce:transition-none group-data-open/machine:rotate-90" />
              <Icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{name}</span>
              {status}
            </span>
          </SidebarGroupLabel>
        </ContextMenuTrigger>
        {onOpenSettings && (
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem onClick={onOpenSettings}>
                Computer settings
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        )}
      </ContextMenu>
      <CollapsibleContent>
        <SidebarMenuSub className="me-0 pe-0">{children}</SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
