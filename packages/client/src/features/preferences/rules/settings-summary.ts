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

export const REVIEWS_GIT_SETTINGS_SUMMARY =
  'Pull, archive and spec files on each computer';
