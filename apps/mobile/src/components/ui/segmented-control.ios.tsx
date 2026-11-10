import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { SegmentedControlProps } from './segmented-control-props';

export function SegmentedControl<Id extends string>({
  options,
  selected,
  onSelect,
}: SegmentedControlProps<Id>) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Picker<Id>
        selection={selected}
        onSelectionChange={onSelect}
        modifiers={[pickerStyle('segmented'), labelsHidden()]}
      >
        {options.map((option) => (
          <Text key={option.id} modifiers={[tag(option.id)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
