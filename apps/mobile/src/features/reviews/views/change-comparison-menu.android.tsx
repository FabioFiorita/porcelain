import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { Button } from '../../../components/ui/button';
import type { ChangeComparisonMenuProps } from './change-comparison-menu-props';

export function ChangeComparisonMenu({
  current,
  scopes,
  onScope,
}: ChangeComparisonMenuProps) {
  return (
    <NativeDropdownMenu
      actions={scopes.map((scope) => ({
        id: scope,
        label: scope,
        onPress: () => onScope(scope),
      }))}
    >
      {(open) => (
        <Button
          label={`Comparison: ${current ?? 'None'}`}
          variant="outline"
          size="sm"
          onPress={open}
        />
      )}
    </NativeDropdownMenu>
  );
}
