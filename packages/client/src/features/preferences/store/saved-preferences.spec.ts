import { expect, it } from 'vitest';
import { defaultReviewGitSettings } from '../rules/review-git-settings.ts';
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
      appearance: 'system',
      diffStyle: 'unified',
      lineOverflow: 'scroll',
      documentsDefault: 'rendered',
      reviewGitSettingsImportCandidate: {
        pullStrategy: 'merge',
        collapseSpecs: false,
        archiveDeleteWorktree: true,
        archiveDeleteLocalBranch: true,
        archiveDeleteRemoteBranch: true,
      },
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
      ...defaultPreferences,
      appearance: 'dark',
      lineOverflow: wrapLongLines ? 'wrap' : 'scroll',
      documentsDefault: 'source',
    });
  },
);
const legacyRecord = {
  commitModel: 'model',
  pullStrategy: 'rebase',
  appearance: 'light',
  diffStyle: 'split',
  lineOverflow: 'wrap',
  documentsDefault: 'source',
  collapseSpecs: true,
  archiveDeleteWorktree: false,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: false,
} as const;
const legacyCandidate = {
  pullStrategy: 'rebase',
  collapseSpecs: true,
  archiveDeleteWorktree: false,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: false,
} as const;
const upgraded = {
  commitModel: 'model',
  appearance: 'light',
  diffStyle: 'split',
  lineOverflow: 'wrap',
  documentsDefault: 'source',
  reviewGitSettingsImportCandidate: legacyCandidate,
} as const;
it('moves the old Reviews & Git choices into the import candidate and writes only the canonical shape', () => {
  const preferences = readPreferences(JSON.stringify(legacyRecord));
  expect(preferences).toEqual(upgraded);
  const encoded = Schema.encodeSync(preferencesSchema)(preferences);
  expect(encoded).toEqual(upgraded);
  expect(readPreferences(JSON.stringify(encoded))).toEqual(upgraded);
});
it('keeps a saved import candidate unchanged even when old fields disagree', () => {
  expect(
    readPreferences(
      JSON.stringify({
        ...upgraded,
        pullStrategy: 'merge',
        collapseSpecs: false,
        archiveDeleteWorktree: true,
      }),
    ),
  ).toEqual(upgraded);
});
it('recaptures the candidate from old fields when the saved candidate is damaged', () => {
  expect(
    readPreferences(
      JSON.stringify({
        ...legacyRecord,
        reviewGitSettingsImportCandidate: { pullStrategy: 'squash' },
      }),
    ),
  ).toEqual(upgraded);
});
it.each([
  ['pullStrategy', 'fast-forward'],
  ['collapseSpecs', 'true'],
  ['archiveDeleteWorktree', 0],
  ['archiveDeleteLocalBranch', null],
  ['archiveDeleteRemoteBranch', 'no'],
] as const)(
  'captures today’s default for an invalid old %s and keeps the other old choices',
  (key, value) => {
    expect(
      readPreferences(JSON.stringify({ ...legacyRecord, [key]: value }))
        .reviewGitSettingsImportCandidate,
    ).toEqual({
      ...legacyCandidate,
      [key]: defaultReviewGitSettings[key],
    });
  },
);
it.each([
  ['commitModel', 12],
  ['commitModel', 'x'.repeat(COMMIT_MODEL_LENGTH + 1)],
  ['appearance', 'automatic'],
  ['diffStyle', 'side-by-side'],
  ['lineOverflow', true],
  ['documentsDefault', 'preview'],
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
  'appearance',
  'diffStyle',
  'lineOverflow',
  'documentsDefault',
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
  const old = upgraded;
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

it('ignores obsolete review-status collapse choices without losing other preferences', () => {
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
  expect(saved).not.toHaveProperty('reviewListGroupOpen');
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
