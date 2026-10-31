import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { IconButton } from '../../../components/ui/icon-button';
import type { CreateMenuProps } from './create-menu-props';

export function CreateMenu({ onFile, onFolder }: CreateMenuProps) {
  return (
    <NativeDropdownMenu
      actions={[
        { id: 'file', label: 'New file', onPress: onFile },
        { id: 'folder', label: 'New folder', onPress: onFolder },
      ]}
    >
      {(open) => (
        <IconButton
          icon="add"
          accessibilityLabel="Create file or folder"
          onPress={open}
        />
      )}
    </NativeDropdownMenu>
  );
}
