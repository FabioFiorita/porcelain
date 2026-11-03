import { ButtonSurface, type ButtonSurfaceProps } from './button-surface';
import { Icon, type IconName } from './icon';
const glyphTones = {
  filled: 'brandForeground',
  tonal: 'default',
  plain: 'default',
  destructive: 'destructive',
  destructivePlain: 'destructive',
} as const;
export function IconButton({
  icon,
  variant = 'plain',
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
      {pending ? null : (
        <Icon
          name={icon}
          tone={glyphTones[variant]}
          size={size === 'sm' ? 'control' : 'glyph'}
        />
      )}
    </ButtonSurface>
  );
}
