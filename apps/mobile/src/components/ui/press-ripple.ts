import type { PressableAndroidRippleConfig } from 'react-native';
import { useCSSVariable } from 'uniwind';

export function usePressRipple(
  shape: 'bounded' | 'glyph',
): PressableAndroidRippleConfig | undefined {
  const color = useCSSVariable('--border-strong');
  if (typeof color !== 'string') return undefined;
  return shape === 'glyph'
    ? { color, borderless: true, radius: 24 }
    : { color, foreground: true };
}
