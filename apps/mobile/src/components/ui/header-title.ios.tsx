import { Text } from './text';

export function HeaderTitle({ children }: { children: string }) {
  return (
    <Text variant="headline" numberOfLines={1}>
      {children}
    </Text>
  );
}
