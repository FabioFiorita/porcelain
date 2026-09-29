import {
  CopyIcon,
  CopyPlusIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  FileDiffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  HistoryIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { TreeAction } from '../rules/tree-actions';

type MenuListProps = {
  actions: readonly { id: TreeAction; label: string }[];
  hidden: boolean;
  onAction: (id: TreeAction) => void;
};

type Props = MenuListProps & {
  path: string;
  anchor: HTMLElement;
  onMenuKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

const icons = {
  'new-file': FilePlusIcon,
  'new-folder': FolderPlusIcon,
  rename: PencilIcon,
  duplicate: CopyPlusIcon,
  open: FileCodeIcon,
  'open-file': FileCodeIcon,
  'open-diff': FileDiffIcon,
  timeline: HistoryIcon,
  pin: PinIcon,
  hide: EyeOffIcon,
  'copy-relative': CopyIcon,
  'copy-full': CopyIcon,
  trash: Trash2Icon,
};

export function FileTreeMenu({
  path,
  anchor,
  actions,
  hidden,
  onAction,
  onMenuKeyDown,
}: Props) {
  return (
    <ContextMenu defaultOpen>
      <ContextMenuTrigger aria-label={`${path} actions`} className="sr-only" />
      <ContextMenuContent
        anchor={anchor}
        side="bottom"
        align="start"
        data-file-tree-context-menu-root="true"
        onKeyDownCapture={onMenuKeyDown}
      >
        <FileTreeMenuList
          actions={actions}
          hidden={hidden}
          onAction={onAction}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FileTreeMenuList({ actions, hidden, onAction }: MenuListProps) {
  return actions.map((action) => (
    <FileTreeMenuAction
      key={action.id}
      action={action}
      onAction={onAction}
      hidden={hidden}
    />
  ));
}

function FileTreeMenuAction({
  action,
  onAction,
  hidden,
}: {
  action: { id: TreeAction; label: string };
  onAction: (id: TreeAction) => void;
  hidden: boolean;
}) {
  const Icon = action.id === 'hide' && hidden ? EyeIcon : icons[action.id];
  return (
    <>
      {(action.id === 'hide' ||
        action.id === 'copy-relative' ||
        action.id === 'trash') && <ContextMenuSeparator />}
      <ContextMenuItem
        variant={action.id === 'trash' ? 'destructive' : 'default'}
        onPointerDownCapture={() => onAction(action.id)}
        onKeyDownCapture={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onAction(action.id);
        }}
      >
        <Icon />
        {action.label}
      </ContextMenuItem>
    </>
  );
}
