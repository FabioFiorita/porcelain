import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useId, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  CheckIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  Columns2Icon,
  CopyIcon,
  EllipsisIcon,
  FileDiffIcon,
  FileIcon,
  HistoryIcon,
  MessageSquarePlusIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';
import type { ReviewSidebarAction } from '@porcelain/client/changes/rules';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const icons: Record<ReviewSidebarAction['id'], LucideIcon> = {
  open: FileDiffIcon,
  review: CheckIcon,
  comment: MessageSquarePlusIcon,
  'open-to-side': Columns2Icon,
  'open-file': FileIcon,
  timeline: HistoryIcon,
  'copy-relative': CopyIcon,
  discard: Undo2Icon,
  'expand-all': ChevronsUpDownIcon,
  'collapse-all': ChevronsDownUpIcon,
};

function ActionIcon({ action }: { action: ReviewSidebarAction }) {
  const Icon = icons[action.id];
  return <Icon />;
}

export function SidebarActionMenu({
  actions,
  label,
  description,
  writeBlock,
  onAction,
  children,
}: {
  actions: readonly ReviewSidebarAction[];
  label: string;
  description?: string;
  writeBlock?: string | undefined;
  onAction: (id: ReviewSidebarAction['id']) => void;
  children: (menu: ReactNode) => ReactNode;
}) {
  const descriptionId = useId();
  const [openingSide, setOpeningSide] = useState(false);
  const blocked = (id: ReviewSidebarAction['id']) =>
    id === 'review' || id === 'discard' ? writeBlock : undefined;
  const act = (id: ReviewSidebarAction['id']) => {
    if (blocked(id)) return;
    if (id === 'open-to-side') flushSync(() => setOpeningSide(true));
    onAction(id);
  };
  const itemProps = (action: ReviewSidebarAction) => {
    const reason = blocked(action.id);
    return {
      disabled: action.disabled || Boolean(reason),
      'aria-description': reason,
      destructive: action.destructive === true,
      onSelect: () => act(action.id),
    };
  };
  const reset = (open: boolean) => {
    if (open) setOpeningSide(false);
  };
  return (
    <ContextMenu onOpenChange={reset}>
      <ContextMenuTrigger render={<div className="min-w-0" />}>
        {children(
          <DropdownMenu onOpenChange={reset}>
            {description && (
              <span id={descriptionId} className="sr-only">
                {description}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0"
                        aria-label={label}
                        aria-describedby={
                          description ? descriptionId : undefined
                        }
                      />
                    }
                  >
                    <EllipsisIcon />
                  </DropdownMenuTrigger>
                }
              />
              <TooltipContent role="tooltip" className="break-all">
                {label}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              finalFocus={openingSide ? 'none' : 'trigger'}
            >
              {actions.map((action) => (
                <DropdownMenuItem key={action.id} {...itemProps(action)}>
                  <ActionIcon action={action} />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>,
        )}
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={openingSide ? 'none' : 'trigger'}>
        {actions.map((action) => (
          <ContextMenuItem key={action.id} {...itemProps(action)}>
            <ActionIcon action={action} />
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
