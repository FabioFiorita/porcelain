import { useCSSVariable } from 'uniwind';

export function useTabBarColors() {
  const foreground = useCSSVariable('--foreground');
  return typeof foreground === 'string' ? { tintColor: foreground } : {};
}
