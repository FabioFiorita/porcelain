import { useWindowDimensions } from 'react-native';

export const headerBarSpace = { leading: 88, item: 56 };
const widestTitle = 480;

export const headerTitleText = { variant: 'headline' } as const;

export function useHeaderTitleFrame(trailingItems: number) {
  const { width } = useWindowDimensions();
  return {
    className: 'items-center',
    style: {
      maxWidth: Math.min(
        widestTitle,
        width - headerBarSpace.leading - headerBarSpace.item * trailingItems,
      ),
    },
  };
}
