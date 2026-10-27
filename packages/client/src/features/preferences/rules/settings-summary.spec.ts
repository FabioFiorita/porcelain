import { expect, it } from 'vitest';
import {
  generalSettingsSummary,
  REVIEWS_GIT_SETTINGS_SUMMARY,
} from './settings-summary.ts';

it.each([['system', 'wrap', 'System theme · Wrap long lines']] as const)(
  'summarizes General for %s and %s',
  (appearance, lineOverflow, summary) => {
    expect(generalSettingsSummary({ appearance, lineOverflow })).toBe(summary);
  },
);

it('says Reviews & Git settings belong to each computer', () => {
  expect(REVIEWS_GIT_SETTINGS_SUMMARY).toBe(
    'Pull, archive and spec files on each computer',
  );
});
