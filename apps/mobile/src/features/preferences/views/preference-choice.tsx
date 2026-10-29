import { useState } from 'react';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import { Item } from '../../../components/ui/item';

export function PreferenceChoice<T extends string | boolean>({
  label,
  description,
  value,
  options,
  disabled,
  onChange,
  inline = false,
}: {
  inline?: boolean;
  label: string;
  description: string;
  value: T | undefined;
  options: readonly { value: T; label: string; id: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const sideBySide = inline && width >= 560;
  const choices = (
    <Box
      className={sideBySide ? 'shrink-0 flex-row' : 'flex-row flex-wrap pt-2'}
      gap={sideBySide ? 0.5 : 2}
    >
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
  );
  return (
    <Box onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}>
      {sideBySide ? <Separator /> : null}
      <Item
        title={label}
        description={description}
        variant={sideBySide ? 'default' : 'outline'}
        trailing={
          sideBySide ? <Card className="shrink-0">{choices}</Card> : undefined
        }
      >
        {sideBySide ? null : choices}
      </Item>
      {sideBySide ? <Separator /> : null}
    </Box>
  );
}
