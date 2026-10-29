import { ContentMenu } from '../../../components/ui/content-menu.android';
import type { ComparisonMenuProps } from './comparison-menu-props';

export function ComparisonMenu({
  comparison,
  bases,
  onComparison,
}: ComparisonMenuProps) {
  return (
    <ContentMenu
      label={comparison.kind === 'worktree' ? 'Uncommitted' : 'Branch'}
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
  );
}
