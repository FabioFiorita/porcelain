import { expect, it } from 'vitest';
import { groupedCommitModels, resolveCommitModel } from './commit-model';

const models = [
  'codex:gpt-6-astra',
  'codex:gpt-5.6-luna',
  'claude:sonnet',
  'claude:haiku',
].map((id) => ({ id, label: id }));
it('groups models by the provider prefix', () => {
  expect(groupedCommitModels(models)).toEqual([
    [
      'codex',
      [
        { id: 'codex:gpt-6-astra', label: 'codex:gpt-6-astra' },
        { id: 'codex:gpt-5.6-luna', label: 'codex:gpt-5.6-luna' },
      ],
    ],
    [
      'claude',
      [
        { id: 'claude:sonnet', label: 'claude:sonnet' },
        { id: 'claude:haiku', label: 'claude:haiku' },
      ],
    ],
  ]);
});

it('uses Luna or Sonnet instead of a CLI default or the first expensive model', () => {
  expect(resolveCommitModel(models, '')).toBe('codex:gpt-5.6-luna');
  expect(resolveCommitModel(models, 'codex:default')).toBe(
    'codex:gpt-5.6-luna',
  );
  expect(
    resolveCommitModel(
      models.filter((model) => !model.id.includes('luna')),
      'removed',
    ),
  ).toBe('claude:sonnet');
  expect(resolveCommitModel(models.slice(3), '')).toBe('claude:haiku');
  expect(resolveCommitModel(models, 'claude:haiku')).toBe('claude:haiku');
  expect(resolveCommitModel(models.slice(0, 1), '')).toBeUndefined();
  expect(
    resolveCommitModel(
      [{ id: 'codex:default', label: 'Default' }],
      'codex:default',
    ),
  ).toBeUndefined();
  expect(resolveCommitModel(undefined, '')).toBeUndefined();
});
