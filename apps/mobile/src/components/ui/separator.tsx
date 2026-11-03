import { View } from 'react-native';
const horizontal = {
  full: 'h-px w-full bg-border',
  content: 'ml-4 h-px bg-border',
  leading: 'ml-17 h-px bg-border',
};
export function Separator({
  orientation = 'horizontal',
  inset = 'full',
}: {
  orientation?: 'horizontal' | 'vertical';
  inset?: keyof typeof horizontal;
}) {
  return (
    <View
      accessible={false}
      className={
        orientation === 'horizontal'
          ? horizontal[inset]
          : 'w-px self-stretch bg-border'
      }
    />
  );
}
