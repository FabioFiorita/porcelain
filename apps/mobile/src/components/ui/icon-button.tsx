import {
  ButtonSurface,
  buttonTones,
  type ButtonSurfaceProps,
} from './button-surface';
import { Icon, type IconName } from './icon';
export function IconButton({
  icon,
  variant = 'ghost',
  size = 'default',
  pending = false,
  ...props
}: Omit<ButtonSurfaceProps, 'children' | 'size'> & {
  icon: IconName;
  size?: 'default' | 'sm';
}) {
  return (
    <ButtonSurface
      {...props}
      variant={variant}
      size={size === 'sm' ? 'iconSm' : 'icon'}
      pending={pending}
    >
      {pending ? null : <Icon name={icon} tone={buttonTones[variant]} />}
    </ButtonSurface>
  );
}
