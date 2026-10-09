import { TextInput, type TextInputProps } from 'react-native';
export function Input({
  disabled = false,
  invalid = false,
  multiline = false,
  className,
  accessibilityState,
  ...props
}: Omit<TextInputProps, 'style' | 'editable'> & {
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <TextInput
      {...props}
      multiline={multiline}
      editable={!disabled}
      accessibilityState={{ ...accessibilityState, disabled }}
      aria-invalid={invalid}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColorClassName="accent-muted-foreground"
      selectionColorClassName="accent-primary"
      className={[
        'w-full min-w-0 rounded-2xl border bg-input/50 px-3 text-ui text-foreground focus:border-ring',
        multiline ? 'min-h-24 py-2 leading-5' : 'min-h-11 py-0',
        invalid ? 'border-destructive' : 'border-transparent',
        disabled ? 'opacity-50' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
