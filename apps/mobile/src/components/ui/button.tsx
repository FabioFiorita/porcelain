import {
  ButtonSurface,
  buttonTones,
  heldFilled,
  type ButtonSurfaceProps,
} from './button-surface';
import { Text } from './text';
export function Button({
  label,
  variant = 'filled',
  size = 'default',
  accessibilityLabel = label,
  ...props
}: Omit<ButtonSurfaceProps, 'children' | 'accessibilityLabel' | 'size'> & {
  label: string;
  accessibilityLabel?: string;
  size?: 'default' | 'sm';
}) {
  const held = heldFilled(
    variant,
    props.disabled === true,
    props.pending === true,
  );
  return (
    <ButtonSurface
      {...props}
      variant={variant}
      size={size}
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        accessible={false}
        variant={size === 'sm' ? 'secondary' : 'body'}
        weight={size === 'sm' ? 'medium' : 'semibold'}
        tone={held ? 'muted' : buttonTones[variant]}
        className="shrink text-center"
      >
        {label}
      </Text>
    </ButtonSurface>
  );
}
