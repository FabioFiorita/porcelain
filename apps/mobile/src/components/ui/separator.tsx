import { View } from 'react-native';
export function Separator({
  orientation = 'horizontal',
}: {
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <View
      accessible={false}
      className={
        orientation === 'horizontal'
          ? 'h-px w-full bg-border'
          : 'w-px self-stretch bg-border'
      }
    />
  );
}
