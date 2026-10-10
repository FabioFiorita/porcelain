import { expect, it } from 'vitest';
import { Schema } from 'effect';
import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';
import {
  defaultPreferences,
  readPreferences,
  preferencesSchema,
} from './store.ts';

it.each([null, '{}', 'not-json', 'null', '[]', '42', '"text"'])(
  'recovers unreadable or empty saved preferences: %s',
  (saved) => {
    expect(readPreferences(saved)).toEqual({
      commitModel: '',
      pullStrategy: 'merge',
      appearance: 'system',
      diffStyle: 'unified',
      lineOverflow: 'scroll',
      markdownDefault: 'reader',
      htmlDefault: 'preview',
      collapseSpecs: false,
    });
  },
);
it.each([true, false])(
  'migrates an old mobile record with wrap=%s',
  (wrapLongLines) => {
    expect(
      readPreferences(
        JSON.stringify({
          theme: 'dark',
          wrapLongLines,
          markdownDefault: 'source',
          htmlDefault: 'source',
        }),
      ),
    ).toEqual({
      commitModel: '',
      pullStrategy: 'merge',
      appearance: 'dark',
      diffStyle: 'unified',
      lineOverflow: wrapLongLines ? 'wrap' : 'scroll',
      markdownDefault: 'source',
      htmlDefault: 'source',
      collapseSpecs: false,
    });
  },
);
it('keeps an old web record and writes only the canonical shape', () => {
  const saved = {
    commitModel: 'model',
    pullStrategy: 'rebase',
    appearance: 'light',
    diffStyle: 'split',
    lineOverflow: 'wrap',
    markdownDefault: 'source',
    htmlDefault: 'source',
    collapseSpecs: true,
  } as const;
  expect(readPreferences(JSON.stringify(saved))).toEqual(saved);
  expect(Schema.encodeSync(preferencesSchema)(saved)).toEqual(saved);
});
it.each([
  ['commitModel', 12],
  ['commitModel', 'x'.repeat(COMMIT_MODEL_LENGTH + 1)],
  ['pullStrategy', 'fast-forward'],
  ['appearance', 'automatic'],
  ['diffStyle', 'side-by-side'],
  ['lineOverflow', true],
  ['markdownDefault', 'preview'],
  ['htmlDefault', 'reader'],
  ['collapseSpecs', 'true'],
] as const)(
  'repairs invalid %s without losing another valid field',
  (key, value) => {
    expect(
      readPreferences(
        JSON.stringify({
          ...defaultPreferences,
          commitModel: 'keep me',
          appearance: 'dark',
          [key]: value,
        }),
      ),
    ).toEqual({
      ...defaultPreferences,
      commitModel: 'keep me',
      appearance: 'dark',
      [key]: defaultPreferences[key],
    });
  },
);
it.each([
  'commitModel',
  'pullStrategy',
  'appearance',
  'diffStyle',
  'lineOverflow',
  'markdownDefault',
  'htmlDefault',
  'collapseSpecs',
] as const)('repairs missing %s without losing another field', (key) => {
  const saved: Record<string, unknown> = {
    ...defaultPreferences,
    commitModel: 'keep me',
    appearance: 'dark',
  };
  delete saved[key];
  expect(readPreferences(JSON.stringify(saved))).toEqual({
    ...defaultPreferences,
    commitModel: 'keep me',
    appearance: 'dark',
    [key]: defaultPreferences[key],
  });
});
it('ignores future fields and gives canonical fields precedence over legacy aliases', () => {
  expect(
    readPreferences(
      '{"appearance":"light","theme":"dark","lineOverflow":"scroll","wrapLongLines":true,"future":false}',
    ),
  ).toEqual({ ...defaultPreferences, appearance: 'light' });
});
it('repairs invalid legacy fields independently', () => {
  expect(
    readPreferences(
      '{"theme":"automatic","wrapLongLines":"false","htmlDefault":"source"}',
    ),
  ).toEqual({ ...defaultPreferences, htmlDefault: 'source' });
});
