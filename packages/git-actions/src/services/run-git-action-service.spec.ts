import type {
  GitActionOutcome,
  GitActionRunnerOutcome,
  RunGitActionInput,
} from '@porcelain/git-actions/models';
import type { FileChange } from '@porcelain/kernel/models';
import { describe, expect, it } from 'vitest';
import {
  CLEAN_EXPECTATION,
  GUIDE_FINGERPRINT,
  README_FINGERPRINT,
  sampleRun,
} from '../../spec/fixtures/git-action-samples.ts';
import { ScriptedGitActionRunner } from '../../spec/fakes/scripted-git-action-runner.ts';
import { RunGitActionService } from './run-git-action-service.ts';

const movedHead = 'f'.repeat(40);
const succeeded: GitActionOutcome = {
  state: 'succeeded',
  result: { headOid: movedHead },
  refreshRequired: true,
};
const readme = { path: 'README.md', fingerprint: README_FINGERPRINT };
const commit = sampleRun(
  { action: 'commit', message: 'Fix', paths: ['README.md'] },
  { ...CLEAN_EXPECTATION, files: [readme] },
);
const change = (path: string, fingerprint: string | undefined): FileChange => ({
  path,
  fingerprint,
  comparisons: [{ scope: 'untracked', path }],
});

const gitRan = 'Git ran';

function subject(
  answer: GitActionRunnerOutcome = { kind: 'finished', outcome: succeeded },
  progress: string[] = [gitRan],
) {
  const lines: string[] = [];
  const runner = new ScriptedGitActionRunner({ answer, progress });
  const service = new RunGitActionService(runner);
  return {
    lines,
    execute: (input: Omit<RunGitActionInput, 'onProgress'>) =>
      service.execute({ ...input, onProgress: (line) => lines.push(line) }),
    service,
  };
}

describe('RunGitActionService', () => {
  it('runs the action when the expected files are unchanged', async () => {
    const { lines, execute } = subject();
    const ran = await execute({
      run: commit,
      changes: [
        change('README.md', README_FINGERPRINT),
        change('GUIDE.md', GUIDE_FINGERPRINT),
      ],
    });
    expect(ran.outcome).toEqual(succeeded);
    expect(lines).toEqual([gitRan]);
  });

  it('rejects without touching the worktree when an expected file changed', async () => {
    const { lines, execute } = subject();
    const ran = await execute({
      run: commit,
      changes: [change('README.md', GUIDE_FINGERPRINT)],
    });
    expect(ran.outcome).toEqual({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      refreshRequired: false,
    });
    expect(lines).toEqual([]);
  });

  it('rejects a stash when the worktree gained a change it did not expect', async () => {
    const { lines, execute } = subject();
    const ran = await execute({
      run: sampleRun(
        { action: 'stash-create', message: 'Park', includeUntracked: true },
        { ...CLEAN_EXPECTATION, files: [readme] },
      ),
      changes: [
        change('README.md', README_FINGERPRINT),
        change('GUIDE.md', undefined),
      ],
    });
    expect(ran.outcome.reason).toBe('CHANGED_SINCE_LOOKED');
    expect(lines).toEqual([]);
  });

  it('checks a merge commit against the whole change list', async () => {
    const { lines, execute } = subject();
    const ran = await execute({
      run: sampleRun(
        { action: 'commit', message: 'Merge', paths: [] },
        {
          ...CLEAN_EXPECTATION,
          inProgress: 'merge',
          mergeHeadOid: 'b'.repeat(40),
          files: [readme],
        },
      ),
      changes: [
        change('README.md', README_FINGERPRINT),
        change('GUIDE.md', GUIDE_FINGERPRINT),
      ],
    });
    expect(ran.outcome.reason).toBe('CHANGED_SINCE_LOOKED');
    expect(lines).toEqual([]);
  });

  it('runs an action that expects no files whatever the worktree holds', async () => {
    const { lines, execute } = subject();
    const ran = await execute({
      run: sampleRun({
        action: 'create-branch',
        branch: 'feature',
        switchTo: false,
      }),
      changes: [change('README.md', GUIDE_FINGERPRINT)],
    });
    expect(ran.outcome.state).toBe('succeeded');
    expect(lines).toEqual([gitRan]);
  });

  it('reports an action Git refused as rejected with its reason and detail', async () => {
    const { execute } = subject({
      kind: 'refused',
      reason: 'NON_FAST_FORWARD',
      detail: 'Updates were rejected',
    });
    const ran = await execute({
      run: sampleRun({ action: 'switch-branch', branch: 'main' }),
      changes: [],
    });
    expect(ran.outcome).toEqual({
      state: 'rejected',
      reason: 'NON_FAST_FORWARD',
      message: 'Updates were rejected',
      refreshRequired: false,
    });
  });

  it('reports an action Git stopped at its deadline as interrupted', async () => {
    const { execute } = subject({ kind: 'timed-out' });
    const ran = await execute({
      run: sampleRun({ action: 'switch-branch', branch: 'main' }),
      changes: [],
    });
    expect(ran.outcome).toEqual({
      state: 'interrupted',
      reason: 'DEADLINE_EXCEEDED',
      refreshRequired: false,
    });
  });

  it('marks the review stale only after a commit or amend succeeded', async () => {
    const passing = await subject().service.execute({
      run: commit,
      changes: [change('README.md', README_FINGERPRINT)],
    });
    const rejected = await subject().service.execute({
      run: commit,
      changes: [change('README.md', GUIDE_FINGERPRINT)],
    });
    const branch = await subject().service.execute({
      run: sampleRun({ action: 'switch-branch', branch: 'main' }),
      changes: [],
    });
    expect(passing.reviewStale).toBe(true);
    expect(rejected.reviewStale).toBe(false);
    expect(branch.reviewStale).toBe(false);
  });

  it('passes the progress lines Git reports to the listener', async () => {
    const lines: string[] = [];
    await subject({ kind: 'finished', outcome: succeeded }, [
      'Receiving objects: 100%',
    ]).service.execute({
      run: sampleRun(
        {
          action: 'fetch',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        },
        { ...CLEAN_EXPECTATION, upstream: {} },
      ),
      changes: [],
      onProgress: (line) => lines.push(line),
    });
    expect(lines).toEqual(['Receiving objects: 100%']);
  });
});
