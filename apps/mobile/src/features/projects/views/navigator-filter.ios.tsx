import { Button, Toggle } from '@expo/ui/swift-ui';
import { emptyNavigatorFilter } from '@porcelain/client/projects/rules';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type {
  NavigatorFilterProps,
  NavigatorScopePickerProps,
} from './navigator-filter-props';

export function NavigatorFilter({
  sections,
  filter,
  onChange,
}: NavigatorFilterProps) {
  return (
    <ContentMenu label="Filter worktrees" icon="filter">
      {sections.flatMap((section) =>
        section.items.map((option) => (
          <Toggle
            key={option.id}
            label={option.label}
            isOn={option.checked}
            onIsOnChange={() =>
              onChange({ ...filter, [section.key]: option.next })
            }
          />
        )),
      )}
      <Toggle
        label="Show older reviews"
        isOn={filter.older}
        onIsOnChange={() => onChange({ ...filter, older: !filter.older })}
      />
      <Button
        label="Clear filters"
        onPress={() => onChange(emptyNavigatorFilter)}
      />
    </ContentMenu>
  );
}

export function NavigatorScopePicker({
  section,
  label,
  onChange,
}: NavigatorScopePickerProps) {
  return (
    <ContentMenu label={label}>
      {section.items.map((option) => (
        <Toggle
          key={option.id}
          label={option.label}
          isOn={option.checked}
          onIsOnChange={() => onChange(option.next)}
        />
      ))}
      <Button
        label={
          section.key === 'environments' ? 'All environments' : 'All projects'
        }
        onPress={() => onChange(undefined)}
      />
    </ContentMenu>
  );
}
