import { expect, it } from 'vitest';
import { resolveCommitModel } from './commit-model.ts';

const models = [
  { id: 'claude:sonnet', label: 'Sonnet' },
  { id: 'claude:haiku', label: 'Haiku' },
  { id: 'codex:gpt-6-luna', label: 'Luna' },
];

it('defaults to Haiku for Claude and Luna for Codex while preserving an explicit choice', () => {
  expect({
    claude: resolveCommitModel(models.slice(0, 2), ''),
    codex: resolveCommitModel(models.slice(2), ''),
    both: resolveCommitModel(models, ''),
    chosen: resolveCommitModel(models, 'claude:sonnet'),
  }).toEqual({
    claude: 'claude:haiku',
    codex: 'codex:gpt-6-luna',
    both: 'codex:gpt-6-luna',
    chosen: 'claude:sonnet',
  });
});
