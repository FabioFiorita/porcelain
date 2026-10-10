import * as Schema from 'effect/Schema';
const appearanceOrder = ['system', 'light', 'dark'] as const;
export const appearanceSchema = Schema.Literals(appearanceOrder);
export type Appearance = typeof appearanceSchema.Type;
export function resolvedTheme(
  appearance: Appearance,
  systemDark: boolean,
): 'light' | 'dark' {
  if (appearance !== 'system') return appearance;
  return systemDark ? 'dark' : 'light';
}

export function nextAppearance(appearance: Appearance): Appearance {
  const index = appearanceOrder.indexOf(appearance);
  return appearanceOrder[(index + 1) % appearanceOrder.length] ?? 'system';
}
