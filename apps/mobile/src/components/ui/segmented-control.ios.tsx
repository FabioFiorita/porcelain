import { Host, Picker, Text } from '@expo/ui/swift-ui';
import {
  fixedSize,
  labelsHidden,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import type { SegmentedControlProps } from './segmented-control-props';

export function SegmentedControl<Id extends string>({
  options,
  selected,
  onSelect,
  width = 'fill',
}: SegmentedControlProps<Id>) {
  const content = width === 'content';
  return (
    <Host matchContents={content ? true : { vertical: true }}>
      <Picker<Id>
        selection={selected}
        onSelectionChange={onSelect}
        modifiers={[
          pickerStyle('segmented'),
          labelsHidden(),
          ...(content ? [fixedSize()] : []),
        ]}
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
