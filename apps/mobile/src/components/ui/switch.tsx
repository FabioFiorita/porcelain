import { Switch as NativeSwitch } from 'react-native';
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <NativeSwitch
      accessibilityLabel={label}
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
    />
  );
}
