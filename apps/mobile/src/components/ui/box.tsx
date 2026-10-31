import type { ComponentPropsWithRef } from 'react';
import { View } from 'react-native';

const gaps = {
  0.5: 'gap-0.5',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
};
const paddings = { 2: 'p-2', 4: 'p-4', 6: 'p-6' };
const horizontal = { 2: 'px-2', 4: 'px-4', 6: 'px-6' };
const vertical = { 1: 'py-1', 2: 'py-2', 3: 'py-3', 4: 'py-4', 8: 'py-8' };
const tops = { 2: 'pt-2', 8: 'pt-8' };
const bottoms = { 8: 'pb-8' };
const surfaces = {
  background: 'bg-background',
  sidebar: 'bg-sidebar',
  panel: 'overflow-hidden rounded-xl border border-border bg-background',
};

export type BoxProps = Omit<ComponentPropsWithRef<typeof View>, 'style'> & {
  gap?: keyof typeof gaps;
  padding?: keyof typeof paddings;
  paddingX?: keyof typeof horizontal;
  paddingY?: keyof typeof vertical;
  paddingTop?: keyof typeof tops;
  paddingBottom?: keyof typeof bottoms;
  surface?: keyof typeof surfaces;
  divider?: 'bottom';
};

export function Box({
  gap,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingBottom,
  surface,
  divider,
  className,
  ...props
}: BoxProps) {
  return (
    <View
      {...props}
      className={[
        gap && gaps[gap],
        padding && paddings[padding],
        paddingX && horizontal[paddingX],
        paddingY && vertical[paddingY],
        paddingTop && tops[paddingTop],
        paddingBottom && bottoms[paddingBottom],
        surface && surfaces[surface],
        divider && 'border-b border-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
