import { Children, Fragment, type ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { Box, type BoxProps } from './box';
import { Separator } from './separator';

const variants = {
  default: 'border border-border',
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
      className={['overflow-hidden rounded-md', variants[variant], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function CardRows({ children }: { children: ReactNode }) {
  return (
    <Card>
      {Children.toArray(children).map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Separator /> : null}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}
