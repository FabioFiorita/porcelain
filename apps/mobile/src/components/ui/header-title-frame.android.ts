import { useWindowDimensions } from 'react-native';

const navigationSpace = 72;
const barItemSpace = 48;

export const headerTitleText = { variant: 'title', weight: 'medium' } as const;

export function useHeaderTitleFrame(trailingItems: number) {
  const { width } = useWindowDimensions();
  return {
    className: 'min-w-0 justify-center',
    style: {
      maxWidth: Math.max(
        0,
        width - navigationSpace - barItemSpace * trailingItems,
      ),
    },
  };
}
