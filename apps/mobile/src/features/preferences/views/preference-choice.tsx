import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Item } from '../../../components/ui/item';

export function PreferenceChoice<T extends string | boolean>({
  label,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: T | undefined;
  options: readonly { value: T; label: string; id: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Item title={label} description={description} variant="outline">
      <Box className="flex-row flex-wrap" gap={2} paddingTop={2}>
        {options.map((option) => (
          <Button
            key={option.id}
            testID={option.id}
            label={option.label}
            accessibilityLabel={`${label}: ${option.label}${value === option.value ? ', selected' : ''}`}
            variant={value === option.value ? 'secondary' : 'ghost'}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          />
        ))}
      </Box>
    </Item>
  );
}
