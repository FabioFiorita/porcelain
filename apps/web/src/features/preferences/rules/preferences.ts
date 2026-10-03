import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';

export type Preferences = {
  commitModel: string;
  pullStrategy: 'merge' | 'rebase';
  appearance: 'system' | 'light' | 'dark';
  diffStyle: 'unified' | 'split';
  lineOverflow: 'scroll' | 'wrap';
  markdownDefault: 'reader' | 'source';
  htmlDefault: 'preview' | 'source';
  collapseSpecs: boolean;
};

export const defaultPreferences: Preferences = {
  commitModel: '',
  pullStrategy: 'merge',
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  markdownDefault: 'reader',
  htmlDefault: 'preview',
  collapseSpecs: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readPreferences(stored: unknown): Preferences {
  if (!isRecord(stored)) return defaultPreferences;
  return {
    pullStrategy: stored.pullStrategy === 'rebase' ? 'rebase' : 'merge',
    commitModel:
      typeof stored.commitModel === 'string' &&
      stored.commitModel.length <= COMMIT_MODEL_LENGTH
        ? stored.commitModel
        : '',
    appearance:
      stored.appearance === 'system' ||
      stored.appearance === 'light' ||
      stored.appearance === 'dark'
        ? stored.appearance
        : defaultPreferences.appearance,
    diffStyle:
      stored.diffStyle === 'unified' || stored.diffStyle === 'split'
        ? stored.diffStyle
        : defaultPreferences.diffStyle,
    lineOverflow:
      stored.lineOverflow === 'scroll' || stored.lineOverflow === 'wrap'
        ? stored.lineOverflow
        : defaultPreferences.lineOverflow,
    markdownDefault:
      stored.markdownDefault === 'reader' || stored.markdownDefault === 'source'
        ? stored.markdownDefault
        : defaultPreferences.markdownDefault,
    htmlDefault:
      stored.htmlDefault === 'preview' || stored.htmlDefault === 'source'
        ? stored.htmlDefault
        : defaultPreferences.htmlDefault,
    collapseSpecs: stored.collapseSpecs === true,
  };
}

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
