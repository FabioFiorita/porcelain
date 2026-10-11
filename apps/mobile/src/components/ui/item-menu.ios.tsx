import { Button, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import type { ItemMenuProps } from './item-menu-props';
import { MeasuredItemMenu } from './measured-item-menu';

export function ItemMenu({ actions, ...item }: ItemMenuProps) {
  return (
    <MeasuredItemMenu
      actions={actions}
      item={item}
      menu={(row) => (
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <ContextMenu>
            <ContextMenu.Trigger>
              <RNHostView matchContents>{row}</RNHostView>
            </ContextMenu.Trigger>
            <ContextMenu.Items>
              {actions.map((action) => (
                <Button
                  key={action.id}
                  label={action.label}
                  {...(action.destructive
                    ? { role: 'destructive' as const }
                    : {})}
                  modifiers={[disabled(action.disabled ?? false)]}
                  onPress={action.onPress}
                />
              ))}
            </ContextMenu.Items>
          </ContextMenu>
        </Host>
      )}
    />
  );
}
