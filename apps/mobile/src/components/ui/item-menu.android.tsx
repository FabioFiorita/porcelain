import { useState } from 'react';
import { DropdownMenu, Host, RNHostView } from '@expo/ui/jetpack-compose';
import type { ItemMenuProps } from './item-menu-props';
import { MeasuredItemMenu } from './measured-item-menu';
import { MenuActions } from './menu-actions.android';

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
              <MenuActions
                actions={actions}
                onSelect={() => setExpanded(false)}
              />
            </DropdownMenu.Items>
          </DropdownMenu>
        </Host>
      )}
    />
  );
}
