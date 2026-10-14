import { Button, Host, Menu } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { CreateMenuProps } from './create-menu-props';

export function CreateMenu({ onFile, onFolder }: CreateMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label="Create file or folder"
        systemImage={headerIcon('add')}
        modifiers={[
          buttonStyle('glass'),
          controlSize('large'),
          labelStyle('iconOnly'),
        ]}
      >
        <Button label="New file" onPress={onFile} />
        <Button label="New folder" onPress={onFolder} />
      </Menu>
    </Host>
  );
}
