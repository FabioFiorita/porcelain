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
import { readmeFingerprint } from '../../spec/fakes/git-action-samples.ts';
import { ScriptedCommitDraftWriter } from '../../spec/fakes/scripted-commit-draft-writer.ts';
import { GenerateCommitDraftService } from './generate-commit-draft-service.ts';

const capture: CommitDraftCapture = {
  paths: ['README.md'],
  bundles: [['README.md']],
  evidence: '{"patch":""}',
  expectedFiles: [{ path: 'README.md', fingerprint: readmeFingerprint }],
};
const generate = (generation: CommitDraftGeneration) => {
  const writer = new ScriptedCommitDraftWriter(generation);
  return {
    writer,
    draft: new GenerateCommitDraftService(writer).execute({
      capture,
      mode: 'message',
      model: 'claude:sonnet',
    }),
  };
};

describe('GenerateCommitDraftService', () => {
  it('returns the drafted groups with the files the draft was based on', async () => {
    const groups = [{ message: 'Describe the change', paths: ['README.md'] }];
    const { writer, draft } = generate({ kind: 'drafted', groups });
    expect(await draft).toEqual({
      groups,
      expectedFiles: capture.expectedFiles,
    });
    expect(writer.requests).toEqual([
      {
        mode: 'message',
        model: 'claude:sonnet',
        paths: ['README.md'],
        evidence: capture.evidence,
      },
    ]);
  });

  it('refuses a draft that does not cover the selection', async () => {
    await expect(
      generate({
        kind: 'drafted',
        groups: [{ message: 'Other', paths: ['GUIDE.md'] }],
      }).draft,
    ).rejects.toThrow(CommitGroupsMismatchError);
  });

  it('names why the model could not draft', async () => {
    await expect(generate({ kind: 'unsupported-model' }).draft).rejects.toThrow(
      UnsupportedCommitModelError,
    );
    await expect(generate({ kind: 'tool-missing' }).draft).rejects.toThrow(
      CommitToolMissingError,
    );
    await expect(generate({ kind: 'tool-failed' }).draft).rejects.toThrow(
      CommitToolFailedError,
    );
    await expect(generate({ kind: 'failed' }).draft).rejects.toThrow(
      CommitGenerationFailedError,
    );
  });
});
