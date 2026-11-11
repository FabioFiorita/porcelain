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
  const content = width === 'content';
  return (
    <Host matchContents={content ? true : { vertical: true }}>
      <SingleChoiceSegmentedButtonRow
        modifiers={content ? [] : [fillMaxWidth()]}
      >
        {options.map((option) => (
          <SegmentedButton
            key={option.id}
            selected={option.id === selected}
            onClick={() => onSelect(option.id)}
          >
            <SegmentedButton.Label>
              <Text maxLines={1} softWrap={false}>
                {option.label}
              </Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
