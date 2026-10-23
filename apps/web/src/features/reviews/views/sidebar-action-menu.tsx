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
  ReplyIcon,
  RotateCcwIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';
import type { ReviewSidebarAction } from '@porcelain/client/reviews/rules';
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
  reply: ReplyIcon,
  resolution: CheckIcon,
  reveal: FileIcon,
};

function ActionIcon({ action }: { action: ReviewSidebarAction }) {
  const Icon =
    action.id === 'resolution' && action.label === 'Reopen'
      ? RotateCcwIcon
      : icons[action.id];
  return <Icon />;
}

export function SidebarActionMenu({
  actions,
  label,
  description,
  onAction,
  children,
}: {
  actions: readonly ReviewSidebarAction[];
  label: string;
  description?: string;
  onAction: (id: ReviewSidebarAction['id']) => void;
  children: (menu: ReactNode) => ReactNode;
}) {
  const descriptionId = useId();
  const [openingSide, setOpeningSide] = useState(false);
  const act = (id: ReviewSidebarAction['id']) => {
    if (id === 'open-to-side') flushSync(() => setOpeningSide(true));
    onAction(id);
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
            <DropdownMenuContent align="end" finalFocus={!openingSide}>
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={action.disabled}
                  variant={action.destructive ? 'destructive' : 'default'}
                  onClick={() => act(action.id)}
                >
                  <ActionIcon action={action} />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>,
        )}
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={!openingSide}>
        {actions.map((action) => (
          <ContextMenuItem
            key={action.id}
            disabled={action.disabled}
            variant={action.destructive ? 'destructive' : 'default'}
            onClick={() => act(action.id)}
          >
            <ActionIcon action={action} />
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
