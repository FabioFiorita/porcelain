import { Text } from './text';

export function HeaderTitle({ children }: { children: string }) {
  return (
    <Text variant="heading" numberOfLines={1}>
      {children}
    </Text>
  );
}
