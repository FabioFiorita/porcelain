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
import type { ComponentProps, ComponentType, KeyboardEvent } from 'react';
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TreeAction } from '@porcelain/client/files/rules';

type MenuParts = {
  Item: ComponentType<ComponentProps<typeof ContextMenuItem>>;
  Separator: ComponentType;
};

type MenuListProps = {
  actions: readonly { id: TreeAction; label: string }[];
  hidden: boolean;
  onAction: (id: TreeAction) => void;
  parts?: MenuParts;
};

const contextParts: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
};

const dropdownParts: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
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
  const point = anchor.getBoundingClientRect();
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        aria-label={`${path} actions`}
        className="fixed size-px"
        style={{ left: point.left, top: point.top }}
      />
      <DropdownMenuContent
        data-file-tree-context-menu-root="true"
        onKeyDownCapture={onMenuKeyDown}
      >
        <FileTreeMenuList
          actions={actions}
          hidden={hidden}
          onAction={onAction}
          parts={dropdownParts}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FileTreeMenuList({
  actions,
  hidden,
  onAction,
  parts = contextParts,
}: MenuListProps) {
  return actions.map((action) => (
    <FileTreeMenuAction
      key={action.id}
      action={action}
      onAction={onAction}
      hidden={hidden}
      parts={parts}
    />
  ));
}

function FileTreeMenuAction({
  action,
  onAction,
  hidden,
  parts: { Item, Separator },
}: {
  action: { id: TreeAction; label: string };
  onAction: (id: TreeAction) => void;
  hidden: boolean;
  parts: MenuParts;
}) {
  const Icon = action.id === 'hide' && hidden ? EyeIcon : icons[action.id];
  return (
    <>
      {(action.id === 'hide' ||
        action.id === 'copy-relative' ||
        action.id === 'trash') && <Separator />}
      <Item
        variant={action.id === 'trash' ? 'destructive' : 'default'}
        onClick={() => onAction(action.id)}
      >
        <Icon />
        {action.label}
      </Item>
    </>
  );
}
