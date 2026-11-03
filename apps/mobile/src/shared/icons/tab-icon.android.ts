import { type MaterialIcon } from 'expo-router/native-tabs';
import { type IconName } from './icon';

const symbols = {
  reviews: 'rate_review',
  worktrees: 'account_tree',
} satisfies Record<IconName, NonNullable<MaterialIcon['md']>>;

export function tabIcon(name: IconName): MaterialIcon {
  return { md: symbols[name] };
}
