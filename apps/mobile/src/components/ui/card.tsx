import type { ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';

const variants = {
  default: 'border-border bg-card',
  destructive: 'border-destructive bg-card',
  success: 'border-graph-2/50 bg-graph-2/5',
  warning: 'border-graph-4/60 bg-graph-4/5',
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
      className={['rounded-2xl border', variants[variant], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
