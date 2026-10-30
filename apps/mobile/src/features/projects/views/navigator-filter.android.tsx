import { emptyNavigatorFilter } from '@porcelain/client/projects/rules';
import { NativeDropdownMenu } from '../../../components/ui/dropdown-menu.android';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import type {
  NavigatorFilterProps,
  NavigatorScopePickerProps,
} from './navigator-filter-props';

export function NavigatorFilter({
  sections,
  filter,
  onChange,
}: NavigatorFilterProps) {
  const actions = [
    ...sections.flatMap((section) =>
      section.items.map((option) => ({
        id: `${section.key}/${option.id}`,
        label: `${option.checked ? '✓ ' : ''}${option.label}`,
        onPress: () => onChange({ ...filter, [section.key]: option.next }),
      })),
    ),
    {
      id: 'older',
      label: `${filter.older ? '✓ ' : ''}Show older reviews`,
      onPress: () => onChange({ ...filter, older: !filter.older }),
    },
    {
      id: 'clear',
      label: 'Clear filters',
      onPress: () => onChange(emptyNavigatorFilter),
    },
  ];
  return <NavigatorMenu actions={actions} />;
}

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
  label?: string;
  actions: readonly { id: string; label: string; onPress: () => void }[];
}) {
  return (
    <NativeDropdownMenu actions={actions}>
      {(open) =>
        label ? (
          <Button label={label} variant="outline" size="sm" onPress={open} />
        ) : (
          <IconButton
            icon="filter"
            accessibilityLabel="Filter worktrees"
            onPress={open}
          />
        )
      }
    </NativeDropdownMenu>
  );
}
