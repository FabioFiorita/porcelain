import { Button, Toggle } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { NavigatorScopePickerProps } from './navigator-filter-props';

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
