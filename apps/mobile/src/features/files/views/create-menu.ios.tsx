import { Button } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { CreateMenuProps } from './create-menu-props';

export function CreateMenu({ onFile, onFolder }: CreateMenuProps) {
  return (
    <ContentMenu label="Create file or folder" icon="add" size="sm">
      <Button label="New file" onPress={onFile} />
      <Button label="New folder" onPress={onFolder} />
    </ContentMenu>
  );
}
