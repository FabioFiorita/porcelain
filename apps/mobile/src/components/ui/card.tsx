import { View, type ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';

export function Card({
  children,
  className,
  gap,
  padding,
  ...props
}: Omit<ViewProps, 'style'> & Pick<BoxProps, 'gap' | 'padding'>) {
  return (
    <View
      {...props}
      className={['rounded-lg border border-border bg-card', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Box {...(gap ? { gap } : {})} {...(padding ? { padding } : {})}>
        {children}
      </Box>
    </View>
  );
}
