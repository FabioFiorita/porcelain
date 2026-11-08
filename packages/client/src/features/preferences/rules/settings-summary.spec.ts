import { expect, it } from 'vitest';
import { generalSettingsSummary } from './settings-summary.ts';

it.each([['system', 'wrap', 'System theme · Wrap long lines']] as const)(
  'summarizes General for %s and %s',
  (appearance, lineOverflow, summary) => {
    expect(generalSettingsSummary({ appearance, lineOverflow })).toBe(summary);
  },
);
