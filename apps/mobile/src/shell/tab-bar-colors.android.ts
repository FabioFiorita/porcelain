import { useCSSVariable } from 'uniwind';

function color(value: string | number | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export function useTabBarColors() {
  const [background, foreground, muted, mutedForeground] = useCSSVariable([
    '--background',
    '--foreground',
    '--muted',
    '--muted-foreground',
  ]);
  const selected = color(foreground);
  const other = color(mutedForeground);
  return {
    labelVisibilityMode: 'labeled',
    ...(color(background) ? { backgroundColor: color(background) } : {}),
    ...(color(muted) ? { indicatorColor: color(muted) } : {}),
    ...(selected ? { tintColor: selected } : {}),
    ...(selected && other ? { iconColor: { default: other, selected } } : {}),
    ...(selected && other
      ? {
          labelStyle: {
            default: { color: other },
            selected: { color: selected },
          },
        }
      : {}),
  } as const;
}
