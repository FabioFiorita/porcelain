import type { ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';

export function Card({
  className,
  ...props
}: Omit<ViewProps, 'style'> & Pick<BoxProps, 'gap' | 'padding'>) {
  return (
    <Box
      {...props}
      className={['rounded-2xl border border-border bg-card', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
