import { useWindowDimensions } from 'react-native';

const backButtonSpace = 76;
const barItemSpace = 48;
const widestTitle = 480;

export const headerTitleText = { variant: 'headline' } as const;

export function useHeaderTitleFrame(trailingItems: number) {
  const { width } = useWindowDimensions();
  return {
    className: 'items-center',
    style: {
      maxWidth: Math.min(
        widestTitle,
        width - backButtonSpace - barItemSpace * trailingItems,
      ),
    },
  };
}
