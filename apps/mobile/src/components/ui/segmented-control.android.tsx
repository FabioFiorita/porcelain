import { View } from 'react-native';
import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import type { SegmentedControlProps } from './segmented-control-props';

export function SegmentedControl<Id extends string>({
  options,
  selected,
  onSelect,
  width = 'fill',
}: SegmentedControlProps<Id>) {
  return (
    <View
      className={width === 'content' ? 'w-xl max-w-full' : ''}
      collapsable={false}
    >
      <Host matchContents={{ vertical: true }}>
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          {options.map((option) => (
            <SegmentedButton
              key={option.id}
              selected={option.id === selected}
              onClick={() => onSelect(option.id)}
            >
              <SegmentedButton.Label>
                <Text>{option.label}</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Host>
    </View>
  );
}
