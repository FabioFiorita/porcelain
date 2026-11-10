import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Item } from '../../../components/ui/item';
import { Switch } from '../../../components/ui/switch';

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
    <Card>
      <Item title={label} description={description}>
        <Box className="flex-row flex-wrap" gap={2} paddingTop={2}>
          {options.map((option) => (
            <Button
              key={option.id}
              testID={option.id}
              label={option.label}
              accessibilityLabel={`${label}: ${option.label}${value === option.value ? ', selected' : ''}`}
              variant={value === option.value ? 'filled' : 'tonal'}
              size="sm"
              disabled={disabled}
              onPress={() => onChange(option.value)}
            />
          ))}
        </Box>
      </Item>
    </Card>
  );
}

export function PreferenceSwitch({
  label,
  description,
  checked,
  disabled,
  testID,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  testID?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Item
      {...(testID ? { testID } : {})}
      title={label}
      description={description}
      trailing={
        <Switch
          label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      }
    />
  );
}
