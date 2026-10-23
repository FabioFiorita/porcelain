import { archiveSettings } from './archive.ts';
import type { Appearance } from './preferences.ts';

const themes = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
} as const;

export function generalSettingsSummary(preferences: {
  appearance: Appearance;
  lineOverflow: 'scroll' | 'wrap';
}) {
  return `${themes[preferences.appearance]} · ${
    preferences.lineOverflow === 'wrap'
      ? 'Wrap long lines'
      : 'Scroll long lines'
  }`;
}

export function reviewsGitSettingsSummary(
  preferences: { pullStrategy: 'merge' | 'rebase' } & Record<
    (typeof archiveSettings)[number]['key'],
    boolean
  >,
) {
  return `${preferences.pullStrategy === 'rebase' ? 'Rebase on pull' : 'Merge on pull'} · ${
    archiveSettings.some(({ key }) => preferences[key])
      ? 'Archive cleans up'
      : 'Archive keeps everything'
  }`;
}
