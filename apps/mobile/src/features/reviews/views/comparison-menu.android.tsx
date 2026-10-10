import { View } from 'react-native';
import { ItemMenu } from '../../../components/ui/item-menu';
import type { ComparisonMenuProps } from './comparison-menu-props';

export function ComparisonMenu({
  comparison,
  bases,
  onComparison,
}: ComparisonMenuProps) {
  return (
    <View>
      <ItemMenu
        title={comparison.kind === 'worktree' ? 'Uncommitted' : 'Branch'}
        actions={[
          {
            id: 'worktree',
            label: 'Uncommitted',
            onPress: () => onComparison({ kind: 'worktree' }),
          },
          {
            id: 'branch',
            label: 'Branch',
            onPress: () => onComparison({ kind: 'branch' }),
          },
          ...bases.map((base) => ({
            id: base.ref,
            label: base.name,
            onPress: () => onComparison({ kind: 'branch', base: base.ref }),
          })),
        ]}
      />
    </View>
  );
}
