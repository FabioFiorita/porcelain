import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { Button } from '../../../components/ui/button';
import type { NavigatorScopePickerProps } from './navigator-filter-props';

export function NavigatorScopePicker({
  section,
  label,
  onChange,
}: NavigatorScopePickerProps) {
  return (
    <NavigatorMenu
      label={label}
      actions={[
        ...section.items.map((option) => ({
          id: option.id,
          label: `${option.checked ? '✓ ' : ''}${option.label}`,
          onPress: () => onChange(option.next),
        })),
        {
          id: 'all',
          label:
            section.key === 'environments'
              ? 'All environments'
              : 'All projects',
          onPress: () => onChange(undefined),
        },
      ]}
    />
  );
}

function NavigatorMenu({
  label,
  actions,
}: {
  label: string;
  actions: readonly { id: string; label: string; onPress: () => void }[];
}) {
  return (
    <NativeDropdownMenu actions={actions}>
      {(open) => (
        <Button label={label} variant="tonal" size="sm" onPress={open} />
      )}
    </NativeDropdownMenu>
  );
}
