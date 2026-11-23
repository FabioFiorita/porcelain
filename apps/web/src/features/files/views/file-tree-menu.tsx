import {
  Columns2Icon,
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
import { useElement } from '@/shared/hooks/use-element';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { TreeAction } from '@porcelain/client/files/rules';

type MenuListProps = {
  actions: readonly { id: TreeAction; label: string }[];
  hidden: boolean;
  writeBlock?: string | undefined;
  onAction: (id: TreeAction) => void;
};

type Props = MenuListProps & {
  path: string;
  finalFocus: () => HTMLElement | false;
};

const icons = {
  'new-file': FilePlusIcon,
  'new-folder': FolderPlusIcon,
  rename: PencilIcon,
  duplicate: CopyPlusIcon,
  open: FileCodeIcon,
  'open-file': FileCodeIcon,
  'open-to-side': Columns2Icon,
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
  finalFocus,
  actions,
  hidden,
  writeBlock,
  onAction,
}: Props) {
  const popup = useElement<HTMLDivElement>();
  return (
    <ContextMenuContent
      ref={(element) => popup.attach(element)}
      aria-label={`${path} actions`}
      className="w-max max-w-[calc(100vw-2rem)] whitespace-nowrap"
      onKeyDownCapture={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' || event.target !== event.currentTarget)
          return;
        const first = event.currentTarget.querySelector('[role="menuitem"]');
        if (!(first instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        first.focus();
      }}
      finalFocus={() => {
        const active = document.activeElement;
        const stayed =
          active === document.body || popup.element?.contains(active);
        return (stayed && finalFocus()) || null;
      }}
    >
      <FileTreeMenuList
        actions={actions}
        hidden={hidden}
        onAction={onAction}
        writeBlock={writeBlock}
      />
    </ContextMenuContent>
  );
}

export function FileTreeMenuList({
  actions,
  hidden,
  onAction,
  writeBlock,
}: MenuListProps) {
  return actions.map((action) => (
    <FileTreeMenuAction
      key={action.id}
      action={action}
      onAction={onAction}
      hidden={hidden}
      writeBlock={writeBlock}
    />
  ));
}

function FileTreeMenuAction({
  action,
  onAction,
  hidden,
  writeBlock,
}: {
  action: { id: TreeAction; label: string };
  onAction: (id: TreeAction) => void;
  hidden: boolean;
  writeBlock?: string | undefined;
}) {
  const affectsComputer = [
    'new-file',
    'new-folder',
    'rename',
    'duplicate',
    'pin',
    'hide',
    'trash',
  ].includes(action.id);
  const blocked = affectsComputer ? writeBlock : undefined;
  const Icon = action.id === 'hide' && hidden ? EyeIcon : icons[action.id];
  return (
    <>
      {(action.id === 'hide' ||
        action.id === 'copy-relative' ||
        action.id === 'trash') && <ContextMenuSeparator />}
      <ContextMenuItem
        disabled={Boolean(blocked)}
        aria-description={blocked}
        destructive={action.id === 'trash'}
        onSelect={() => onAction(action.id)}
      >
        <Icon />
        {action.label}
      </ContextMenuItem>
    </>
  );
}
