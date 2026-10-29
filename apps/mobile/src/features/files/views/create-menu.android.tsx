import { ContentMenu } from '../../../components/ui/content-menu.android';
import type { CreateMenuProps } from './create-menu-props';

export function CreateMenu({ onFile, onFolder }: CreateMenuProps) {
  return (
    <ContentMenu
      label="Create file or folder"
      icon="add"
      actions={[
        { id: 'file', label: 'New file', onPress: onFile },
        { id: 'folder', label: 'New folder', onPress: onFolder },
      ]}
    />
  );
}
