import { Column, Host, Text } from '@expo/ui';

export function WorktreeEmpty({ title }: { title: string }) {
  return (
    <Host style={{ flex: 1 }}>
      <Column alignment="center">
        <Text>{title}</Text>
        <Text>Select a worktree to continue.</Text>
      </Column>
    </Host>
  );
}
