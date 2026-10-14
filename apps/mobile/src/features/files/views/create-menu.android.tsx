import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';
import { IconButton } from '../../../components/ui/icon-button';
import type { CreateMenuProps } from './create-menu-props';

export function CreateMenu({ onFile, onFolder }: CreateMenuProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Host matchContents>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <IconButton
              icon="add"
              accessibilityLabel="Create file or folder"
              onPress={() => setExpanded(true)}
            />
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <DropdownMenuItem
            onClick={() => {
              setExpanded(false);
              onFile();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>New file</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setExpanded(false);
              onFolder();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>New folder</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
