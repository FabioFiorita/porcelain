import { DropdownMenuItem, Text } from '@expo/ui/jetpack-compose';
import type { ItemMenuProps } from './item-menu-props';

export function MenuActions({
  actions,
  onSelect,
}: {
  actions: ItemMenuProps['actions'];
  onSelect: () => void;
}) {
  return actions.map((action) => (
    <DropdownMenuItem
      key={action.id}
      enabled={!action.disabled}
      onClick={() => {
        onSelect();
        action.onPress();
      }}
    >
      <DropdownMenuItem.Text>
        <Text>{action.label}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  ));
}
