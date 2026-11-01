import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Text } from '../../../components/ui/text';
import { Icon } from '../../../components/ui/icon';
import type { ComparisonMenuProps } from './comparison-menu-props';
import { View } from 'react-native';

export function ComparisonMenu({
  label,
  maximumWidth,
  bases,
  onComparison,
}: ComparisonMenuProps) {
  return (
    <NativeDropdownMenu
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
    >
      {(open) => (
        <View style={{ maxWidth: maximumWidth }}>
          <ButtonSurface
            className="max-w-full"
            accessibilityLabel={label}
            variant="outline"
            size="sm"
            onPress={open}
          >
            <Text
              accessible={false}
              variant="control"
              weight="medium"
              numberOfLines={1}
              className="shrink"
            >
              {label}
            </Text>
            <Icon name="down" size="small" tone="muted" />
          </ButtonSurface>
        </View>
      )}
    </NativeDropdownMenu>
  );
}
