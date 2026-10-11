import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';
import type { ItemMenuProps } from './item-menu-props';
import { MeasuredItemMenu } from './measured-item-menu';

export function ItemMenu({ actions, ...item }: ItemMenuProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <MeasuredItemMenu
      actions={actions}
      item={item}
      onLongPress={() => setExpanded(true)}
      menu={(row) => (
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <DropdownMenu
            expanded={expanded}
            onDismissRequest={() => setExpanded(false)}
          >
            <DropdownMenu.Trigger>
              <RNHostView matchContents>{row}</RNHostView>
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  enabled={!action.disabled}
                  onClick={() => {
                    setExpanded(false);
                    action.onPress();
                  }}
                >
                  <DropdownMenuItem.Text>
                    <Text>{action.label}</Text>
                  </DropdownMenuItem.Text>
                </DropdownMenuItem>
              ))}
            </DropdownMenu.Items>
          </DropdownMenu>
        </Host>
      )}
    />
  );
}
