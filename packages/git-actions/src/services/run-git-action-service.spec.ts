import type { GitActionOutcome } from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import {
  cleanExpectation,
  guideFingerprint,
  readmeFingerprint,
  sampleRun,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryWorktreeFingerprints } from '../../spec/fakes/in-memory-worktree-fingerprints.ts';
import { ScriptedGitActionWriter } from '../../spec/fakes/scripted-git-action-writer.ts';
import { RunGitActionService } from './run-git-action-service.ts';

const succeeded: GitActionOutcome = {
  state: 'succeeded',
  result: { headOid: 'f'.repeat(40) },
  refreshRequired: true,
};
const commit = sampleRun(
  { action: 'commit', message: 'Fix', paths: ['README.md'] },
  {
    ...cleanExpectation,
    files: [{ path: 'README.md', fingerprint: readmeFingerprint }],
  },
);

function subject(
  changes: Record<string, string | undefined>,
  answer: () => Promise<GitActionOutcome> = async () => succeeded,
) {
  const writer = new ScriptedGitActionWriter(answer);
  return {
    writer,
    service: new RunGitActionService(
      new InMemoryWorktreeFingerprints(changes),
      writer,
    ),
  };
}

describe('RunGitActionService', () => {
  it('runs the action when the expected files are unchanged', async () => {
    const { writer, service } = subject({
      'README.md': readmeFingerprint,
      'GUIDE.md': guideFingerprint,
    });
    const ran = await service.execute({ run: commit });
    expect(ran.outcome).toEqual(succeeded);
    expect(writer.runs).toEqual([commit]);
  });

  it('rejects without touching the worktree when an expected file changed', async () => {
    const { writer, service } = subject({ 'README.md': guideFingerprint });
    const ran = await service.execute({ run: commit });
    expect(ran.outcome).toEqual({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      refreshRequired: false,
    });
    expect(writer.runs).toEqual([]);
  });

  it('rejects a stash when the worktree gained a change it did not expect', async () => {
    const { writer, service } = subject({
      'README.md': readmeFingerprint,
      'GUIDE.md': undefined,
    });
    const ran = await service.execute({
      run: sampleRun(
        { action: 'stash-create', message: 'Park', includeUntracked: true },
        {
          ...cleanExpectation,
          files: [{ path: 'README.md', fingerprint: readmeFingerprint }],
        },
      ),
    });
    expect(ran.outcome.reason).toBe('CHANGED_SINCE_LOOKED');
    expect(writer.runs).toEqual([]);
  });

  it('checks a merge commit against the whole change list', async () => {
    const { service } = subject({
      'README.md': readmeFingerprint,
      'GUIDE.md': guideFingerprint,
    });
    const ran = await service.execute({
      run: sampleRun(
        { action: 'commit', message: 'Merge', paths: [] },
        {
          ...cleanExpectation,
          inProgress: 'merge',
          mergeHeadOid: 'b'.repeat(40),
          files: [{ path: 'README.md', fingerprint: readmeFingerprint }],
        },
      ),
    });
    expect(ran.outcome.reason).toBe('CHANGED_SINCE_LOOKED');
  });

  it('runs an action that expects no files without reading fingerprints', async () => {
    const { writer, service } = subject({ 'README.md': guideFingerprint });
    const run = sampleRun({
      action: 'create-branch',
      branch: 'feature',
      switchTo: false,
    });
    const ran = await service.execute({ run });
    expect(ran.outcome.state).toBe('succeeded');
    expect(writer.runs).toEqual([run]);
  });

  it('reports a Git failure as a rejection', async () => {
    const { service } = subject({}, async () => {
      throw new Error('spawn git ENOENT');
    });
    const ran = await service.execute({
      run: sampleRun({ action: 'switch-branch', branch: 'main' }),
    });
    expect(ran.outcome).toEqual({
      state: 'rejected',
      reason: 'GIT_REJECTED',
      refreshRequired: false,
    });
  });

  it('reports an action stopped by its deadline as interrupted', async () => {
    const controller = new AbortController();
    const { service } = subject({}, async () => {
      controller.abort();
      throw new Error('aborted');
    });
    const ran = await service.execute(
      { run: sampleRun({ action: 'switch-branch', branch: 'main' }) },
      controller.signal,
    );
    expect(ran.outcome).toEqual({
      state: 'interrupted',
      reason: 'DEADLINE_EXCEEDED',
      refreshRequired: false,
    });
  });

  it('marks the review stale only after a commit or amend succeeded', async () => {
    const passing = subject({ 'README.md': readmeFingerprint });
    expect((await passing.service.execute({ run: commit })).reviewStale).toBe(
      true,
    );
    const rejected = subject({ 'README.md': guideFingerprint });
    expect((await rejected.service.execute({ run: commit })).reviewStale).toBe(
      false,
    );
    const branch = subject({});
    const ran = await branch.service.execute({
      run: sampleRun({ action: 'switch-branch', branch: 'main' }),
    });
    expect(ran.reviewStale).toBe(false);
  });

  it('passes the progress lines Git reports to the listener', async () => {
    const lines: string[] = [];
    const service = new RunGitActionService(
      new InMemoryWorktreeFingerprints({}),
      new ScriptedGitActionWriter(async (_run, onProgress) => {
        onProgress?.('Receiving objects: 100%');
        return succeeded;
      }),
    );
    await service.execute({
      run: sampleRun(
        {
          action: 'fetch',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        },
        { ...cleanExpectation, upstream: {} },
      ),
      onProgress: (line) => lines.push(line),
    });
    expect(lines).toEqual(['Receiving objects: 100%']);
  });
});
