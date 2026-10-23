import { expect, it } from 'vitest';
import { Effect, Option, Schema } from 'effect';
import { KeyValueStore } from 'effect/persistence';
import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';
import {
  defaultPreferences,
  readPreferences,
  preferencesSchema,
} from './saved-preferences.ts';

it.each([null, '{}', 'not-json', 'null', '[]', '42', '"text"'])(
  'recovers unreadable or empty saved preferences: %s',
  (saved) => {
    expect(readPreferences(saved)).toEqual({
      commitModel: '',
      pullStrategy: 'merge',
      appearance: 'system',
      diffStyle: 'unified',
      lineOverflow: 'scroll',
      documentsDefault: 'rendered',
      collapseSpecs: false,
      reviewListGroupOpen: {},
      archiveDeleteWorktree: true,
      archiveDeleteLocalBranch: true,
      archiveDeleteRemoteBranch: true,
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
      documentsDefault: 'source',
      collapseSpecs: false,
      reviewListGroupOpen: {},
      archiveDeleteWorktree: true,
      archiveDeleteLocalBranch: true,
      archiveDeleteRemoteBranch: true,
    });
  },
);
it('keeps an old web record and writes only the canonical shape', () => {
  const saved = {
    ...defaultPreferences,
    commitModel: 'model',
    pullStrategy: 'rebase',
    appearance: 'light',
    diffStyle: 'split',
    lineOverflow: 'wrap',
    documentsDefault: 'source',
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
  ['documentsDefault', 'preview'],
  ['collapseSpecs', 'true'],
  ['reviewListGroupOpen', { Projects: 'false' }],
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
  'documentsDefault',
  'collapseSpecs',
  'reviewListGroupOpen',
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
  ).toEqual({ ...defaultPreferences, documentsDefault: 'source' });
});
it('reads web records through the browser key-value path, keeping an old record and repairing only a bad field', async () => {
  const old = {
    ...defaultPreferences,
    commitModel: 'model',
    pullStrategy: 'rebase',
    appearance: 'light',
    diffStyle: 'split',
    lineOverflow: 'wrap',
    documentsDefault: 'source',
    collapseSpecs: true,
  } as const;
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      const preferences = KeyValueStore.toSchemaStore(store, preferencesSchema);
      yield* store.set('old', JSON.stringify(old));
      yield* store.set(
        'damaged',
        JSON.stringify({ ...old, diffStyle: 'side-by-side' }),
      );
      const read = yield* preferences.get('old');
      yield* preferences.set('old', Option.getOrThrow(read));
      return {
        read,
        rewritten: yield* store.get('old'),
        damaged: yield* preferences.get('damaged'),
      };
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );
  expect(result).toEqual({
    read: Option.some(old),
    rewritten: JSON.stringify(old),
    damaged: Option.some({ ...old, diffStyle: 'unified' }),
  });
});

it('round-trips independent review group choices without losing other preferences', () => {
  const saved = readPreferences(
    JSON.stringify({
      appearance: 'dark',
      reviewListGroupOpen: {
        Projects: false,
        'Needs you': true,
        'Waiting on agent': false,
        'Ready to merge': true,
        'No review': false,
        Closed: true,
      },
    }),
  );
  expect(saved.reviewListGroupOpen).toEqual({
    Projects: false,
    'Needs you': true,
    'Waiting on agent': false,
    'Ready to merge': true,
    'No review': false,
    Closed: true,
  });
  expect(
    readPreferences(
      JSON.stringify(Schema.encodeSync(preferencesSchema)(saved)),
    ),
  ).toEqual(saved);
  expect(saved.appearance).toBe('dark');
});

it.each([
  [{}, 'rendered'],
  [{ markdownDefault: 'reader', htmlDefault: 'preview' }, 'rendered'],
  [{ markdownDefault: 'source' }, 'source'],
  [{ htmlDefault: 'source' }, 'source'],
  [{ markdownDefault: 'source', htmlDefault: 'source' }, 'source'],
  [{ markdownDefault: 'source', htmlDefault: 'preview' }, 'source'],
  [{ markdownDefault: 'reader', htmlDefault: 'source' }, 'source'],
  [{ markdownDefault: false, htmlDefault: 'reader' }, 'rendered'],
  [{ documentsDefault: 'rendered', markdownDefault: 'source' }, 'rendered'],
  [{ documentsDefault: 'source', htmlDefault: 'preview' }, 'source'],
] as const)(
  'migrates document choices %j to %s and writes only the new preference',
  (legacy, expected) => {
    const preferences = readPreferences(
      JSON.stringify({ ...legacy, commitModel: 'keep me' }),
    );
    expect(preferences.documentsDefault).toBe(expected);
    expect(preferences.commitModel).toBe('keep me');
    const encoded = Schema.encodeSync(preferencesSchema)(preferences);
    expect(encoded).toEqual({
      ...defaultPreferences,
      documentsDefault: expected,
      commitModel: 'keep me',
    });
    expect(encoded).not.toHaveProperty('markdownDefault');
    expect(encoded).not.toHaveProperty('htmlDefault');
    expect(readPreferences(JSON.stringify(encoded))).toEqual(preferences);
  },
);
