import { expect, it } from 'vitest';
import { Schema } from 'effect';
import {
  appearanceSchema,
  resolvedTheme,
  nextAppearance,
} from './preferences.ts';
it('resolves system appearance and cycles explicit appearance choices', () => {
  expect([
    resolvedTheme('system', true),
    resolvedTheme('system', false),
    resolvedTheme('light', true),
    resolvedTheme('dark', false),
  ]).toEqual(['dark', 'light', 'light', 'dark']);
  expect([
    nextAppearance('system'),
    nextAppearance('light'),
    nextAppearance('dark'),
  ]).toEqual(['light', 'dark', 'system']);
});
it('accepts only the three appearance choices', () => {
  expect(
    ['system', 'light', 'dark', 'automatic', 'Dark'].map(
      Schema.is(appearanceSchema),
    ),
  ).toEqual([true, true, true, false, false]);
});
