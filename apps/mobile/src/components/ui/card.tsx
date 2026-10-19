import type { ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';

const variants = {
  default: 'border-border',
  destructive: 'border-destructive',
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
      className={['rounded-2xl border bg-card', variants[variant], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
