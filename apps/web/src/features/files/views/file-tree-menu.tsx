import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  FileDiffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { TreeAction } from '../rules/tree-actions';

type Props = {
  path: string;
  anchor: { left: number; bottom: number };
  actions: readonly { id: TreeAction; label: string }[];
  hidden: boolean;
  onAction: (id: TreeAction) => void;
};

const icons = {
  'new-file': FilePlusIcon,
  'new-folder': FolderPlusIcon,
  rename: PencilIcon,
  open: FileCodeIcon,
  'open-file': FileCodeIcon,
  'open-diff': FileDiffIcon,
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
}: Props) {
  return (
    <ContextMenu defaultOpen>
      <ContextMenuTrigger
        aria-label={`${path} actions`}
        className="fixed size-px"
        style={{ left: anchor.left, top: anchor.bottom }}
      />
      <ContextMenuContent side="bottom" align="start">
        {actions.map((action) => (
          <FileTreeMenuAction
            key={action.id}
            action={action}
            onAction={onAction}
            hidden={hidden}
          />
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
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
