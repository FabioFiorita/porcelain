import type { EnvironmentMenuProps } from '../../../shared/environment-menu';
import { Button, ContextMenu } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';

export function EnvironmentMenu({
  children,
  onForget,
  isPending,
}: EnvironmentMenuProps) {
  return (
    <ContextMenu>
      <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
      <ContextMenu.Items>
        <Button
          label="Forget environment"
          role="destructive"
          onPress={onForget}
          modifiers={[disabled(isPending)]}
        />
      </ContextMenu.Items>
    </ContextMenu>
  );
}
