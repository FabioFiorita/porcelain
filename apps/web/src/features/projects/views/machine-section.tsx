import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SidebarGroupLabel, SidebarMenuSub } from '@/components/ui/sidebar';

export function MachineSection({
  name,
  icon: Icon,
  status,
  children,
}: {
  name: string;
  icon: LucideIcon;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen
      role="group"
      aria-label={name}
      className="group/machine mb-2"
    >
      <SidebarGroupLabel render={<CollapsibleTrigger />} className="w-full">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <ChevronRightIcon className="size-3.5 shrink-0 transition-transform motion-reduce:transition-none group-data-open/machine:rotate-90" />
          <Icon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{name}</span>
          {status}
        </span>
      </SidebarGroupLabel>
      <CollapsibleContent>
        <SidebarMenuSub className="me-0 pe-0">{children}</SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
