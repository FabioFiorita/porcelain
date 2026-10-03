import {
  CommitGenerationFailedError,
  CommitGroupsMismatchError,
  CommitToolFailedError,
  CommitToolMissingError,
  UnsupportedCommitModelError,
} from '@porcelain/git-actions/errors';
import type {
  CommitDraftCapture,
  CommitDraftGeneration,
} from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import { README_FINGERPRINT } from '../../spec/fixtures/git-action-samples.ts';
import { ScriptedCommitDraftSource } from '../../spec/fakes/scripted-commit-draft-source.ts';
import { GenerateCommitDraftService } from './generate-commit-draft-service.ts';

const capture: CommitDraftCapture = {
  paths: ['README.md'],
  bundles: [['README.md']],
  evidence: '{"patch":""}',
  expectedFiles: [{ path: 'README.md', fingerprint: README_FINGERPRINT }],
};
const limits = { maxGroups: 20, maxMessageBytes: 16_384 };
const generate = (
  generations: Record<string, CommitDraftGeneration>,
  model = 'claude:sonnet',
) =>
  new GenerateCommitDraftService(
    new ScriptedCommitDraftSource(generations),
    limits,
  ).execute({ capture, mode: 'message', model });

describe('GenerateCommitDraftService', () => {
  it('returns the groups the chosen model drafted with the files the draft was based on', async () => {
    const groups = [{ message: 'Describe the change', paths: ['README.md'] }];
    await expect(
      generate({
        'claude:sonnet': { kind: 'drafted', groups },
        'codex:gpt': {
          kind: 'drafted',
          groups: [{ message: 'Other model', paths: ['README.md'] }],
        },
      }),
    ).resolves.toEqual({ groups, expectedFiles: capture.expectedFiles });
  });

  it('refuses a draft that does not cover the selection', async () => {
    await expect(
      generate({
        'claude:sonnet': {
          kind: 'drafted',
          groups: [{ message: 'Other', paths: ['GUIDE.md'] }],
        },
      }),
    ).rejects.toThrow(CommitGroupsMismatchError);
  });

  it.each([
    {
      generation: { kind: 'unsupported-model' } satisfies CommitDraftGeneration,
      error: UnsupportedCommitModelError,
    },
    {
      generation: { kind: 'tool-missing' } satisfies CommitDraftGeneration,
      error: CommitToolMissingError,
    },
    {
      generation: { kind: 'tool-failed' } satisfies CommitDraftGeneration,
      error: CommitToolFailedError,
    },
    {
      generation: { kind: 'failed' } satisfies CommitDraftGeneration,
      error: CommitGenerationFailedError,
    },
  ])(
    'names why the model could not draft when generation answers $generation.kind',
    async ({ generation, error }) => {
      await expect(generate({ 'claude:sonnet': generation })).rejects.toThrow(
        error,
      );
    },
  );
});
