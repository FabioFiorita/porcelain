import { Text } from './text';

export function HeaderTitle({ children }: { children: string }) {
  return (
    <Text variant="heading" weight="medium" numberOfLines={1}>
      {children}
    </Text>
  );
}
