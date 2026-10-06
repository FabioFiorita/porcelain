export const defaultPreferences = {
  commitModel: '',
  pullStrategy: 'merge',
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  markdownDefault: 'reader',
  htmlDefault: 'preview',
  collapseSpecs: false,
} as const;
export type Preferences = {
  readonly commitModel: string;
  readonly pullStrategy: 'merge' | 'rebase';
  readonly appearance: 'system' | 'light' | 'dark';
  readonly diffStyle: 'unified' | 'split';
  readonly lineOverflow: 'scroll' | 'wrap';
  readonly markdownDefault: 'reader' | 'source';
  readonly htmlDefault: 'preview' | 'source';
  readonly collapseSpecs: boolean;
};

export function resolvedTheme(
  appearance: Preferences['appearance'],
  systemDark: boolean,
): 'light' | 'dark' {
  if (appearance !== 'system') return appearance;
  return systemDark ? 'dark' : 'light';
}

const appearanceOrder = ['system', 'light', 'dark'] as const;

export function nextAppearance(
  appearance: Preferences['appearance'],
): Preferences['appearance'] {
  const index = appearanceOrder.indexOf(appearance);
  return appearanceOrder[(index + 1) % appearanceOrder.length] ?? 'system';
}
