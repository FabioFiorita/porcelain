import { useState, type ReactElement } from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';

export function NativeDropdownMenu({
  actions,
  children,
}: {
  actions: readonly { id: string; label: string; onPress: () => void }[];
  children: (open: () => void) => ReactElement;
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
            {children(() => setExpanded(true))}
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
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
  );
}
