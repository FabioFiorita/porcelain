import type { EnvironmentMenuProps } from '../../../shared/environment-menu';
import { DropdownMenu, DropdownMenuItem, Text } from '@expo/ui/jetpack-compose';

export function EnvironmentMenu({
  children,
  onForget,
  isPending,
}: EnvironmentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenuItem enabled={!isPending} onClick={onForget}>
          <DropdownMenuItem.Text>
            <Text>Forget environment</Text>
          </DropdownMenuItem.Text>
        </DropdownMenuItem>
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
