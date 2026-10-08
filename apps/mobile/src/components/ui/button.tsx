import {
  ButtonSurface,
  buttonTones,
  type ButtonSurfaceProps,
} from './button-surface';
import { Text } from './text';
export function Button({
  label,
  variant = 'default',
  accessibilityLabel = label,
  ...props
}: Omit<ButtonSurfaceProps, 'children' | 'accessibilityLabel' | 'size'> & {
  label: string;
  accessibilityLabel?: string;
  size?: 'default' | 'sm';
}) {
  return (
    <ButtonSurface
      {...props}
      variant={variant}
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        accessible={false}
        variant={variant === 'link' ? 'link' : 'ui'}
        weight="medium"
        tone={buttonTones[variant]}
        className="shrink text-center"
      >
        {label}
      </Text>
    </ButtonSurface>
  );
}
