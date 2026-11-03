import type { ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';

const variants = {
  default: 'bg-foreground/5',
  destructive: 'bg-del-bg',
  success: 'bg-add-bg',
  warning: 'bg-warn-soft',
};

export function Card({
  className,
  variant = 'default',
  ...props
}: Omit<ViewProps, 'style'> &
  Pick<BoxProps, 'gap' | 'padding'> & { variant?: keyof typeof variants }) {
  return (
    <Box
      {...props}
      className={['overflow-hidden rounded-paper', variants[variant], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
