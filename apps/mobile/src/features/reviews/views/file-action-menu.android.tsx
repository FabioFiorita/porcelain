import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { IconButton } from '../../../components/ui/icon-button';
import type { FileActionMenuProps } from './file-action-menu-props';

export function FileActionMenu({ label, actions }: FileActionMenuProps) {
  return (
    <NativeDropdownMenu actions={actions}>
      {(open) => (
        <IconButton
          icon="more"
          size="sm"
          accessibilityLabel={label}
          onPress={open}
        />
      )}
    </NativeDropdownMenu>
  );
}
