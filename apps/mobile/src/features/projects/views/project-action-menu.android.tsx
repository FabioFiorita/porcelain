import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { IconButton } from '../../../components/ui/icon-button';
import type { ProjectActionMenuProps } from './project-action-menu-props';

export function ProjectActionMenu({ label, actions }: ProjectActionMenuProps) {
  return (
    <NativeDropdownMenu actions={actions}>
      {(open) => (
        <IconButton icon="more" accessibilityLabel={label} onPress={open} />
      )}
    </NativeDropdownMenu>
  );
}
