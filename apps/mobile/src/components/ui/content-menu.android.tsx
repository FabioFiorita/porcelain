import { DropdownMenu, Host, RNHostView } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { ButtonSurface } from './button-surface';
import { Icon, type IconName } from './icon';
import { IconButton } from './icon-button';
import type { ItemMenuProps } from './item-menu-props';
import { MenuActions } from './menu-actions.android';
import { Text } from './text';

export function ContentMenu({
  label,
  icon,
  actions,
}: {
  label: string;
  icon?: IconName;
  actions: ItemMenuProps['actions'];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Host matchContents>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            {icon ? (
              <IconButton
                icon={icon}
                accessibilityLabel={label}
                onPress={() => setExpanded(true)}
              />
            ) : (
              <ButtonSurface
                accessibilityLabel={label}
                variant="outline"
                expanded={expanded}
                onPress={() => setExpanded(true)}
              >
                <Text accessible={false} variant="ui" weight="medium">
                  {label}
                </Text>
                <Icon name="down" size="small" tone="muted" />
              </ButtonSurface>
            )}
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <MenuActions actions={actions} onSelect={() => setExpanded(false)} />
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
