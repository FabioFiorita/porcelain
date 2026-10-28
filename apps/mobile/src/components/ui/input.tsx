import type { ReactNode } from 'react';
import { View, TextInput, type TextInputProps } from 'react-native';
export function Input({
  leading,
  disabled = false,
  invalid = false,
  multiline = false,
  className,
  accessibilityState,
  ...props
}: Omit<TextInputProps, 'style' | 'editable'> & {
  leading?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const input = (
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
        'font-sans w-full min-w-0 rounded-md border bg-input/20 px-2 text-xs dark:bg-input/30 text-foreground focus:border-ring',
        multiline ? 'min-h-24 py-2 leading-5' : 'min-h-11 py-0',
        invalid ? 'border-destructive' : 'border-input',
        disabled ? 'opacity-50' : '',
        leading ? 'pl-10' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
  return leading ? (
    <View className="relative w-full">
      {input}
      <View
        className="pointer-events-none absolute inset-y-0 left-3 justify-center"
        accessible={false}
      >
        {leading}
      </View>
    </View>
  ) : (
    input
  );
}
