import { View, type ViewProps } from 'react-native';

const gaps = { 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6' };
const paddings = { 4: 'p-4', 6: 'p-6' };
const horizontal = { 4: 'px-4', 6: 'px-6' };
const vertical = { 2: 'py-2', 3: 'py-3', 4: 'py-4', 8: 'py-8' };
const tops = { 2: 'pt-2' };
const bottoms = { 8: 'pb-8' };

export type BoxProps = Omit<ViewProps, 'style'> & {
  gap?: keyof typeof gaps;
  padding?: keyof typeof paddings;
  paddingX?: keyof typeof horizontal;
  paddingY?: keyof typeof vertical;
  paddingTop?: keyof typeof tops;
  paddingBottom?: keyof typeof bottoms;
  surface?: 'background';
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
        surface && 'bg-background',
        divider && 'border-b border-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
