import { describe, expect, it } from 'vitest';
import { GitWorktreeListingReader } from './git-worktree-listing-reader.ts';

const project = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
};

function reader(failure: unknown) {
  const reports: { kind: string; projectId?: string; error: unknown }[] = [];
  const listing = new GitWorktreeListingReader({
    git: () => ({
      listWorktrees: () => Promise.reject(failure),
      readOriginUrl: async () => null,
    }),
    sharedReads: {
      run: (_key, work, signal) => work(signal ?? new AbortController().signal),
    },
    launchLimit: { run: (work) => work() },
    timeoutMs: 5000,
    worktreeId: (projectId, metadataIdentity) =>
      `${projectId}:${metadataIdentity}`,
    logger: { failure: (report) => reports.push(report) },
  });
  return { listing, reports };
}

describe('GitWorktreeListingReader', () => {
  it('reports a project whose listing fails unexpectedly as unavailable and logs why', async () => {
    const failure = new Error('git output could not be parsed');
    const { listing, reports } = reader(failure);
    expect(await listing.list(project)).toEqual({
      kind: 'unavailable',
      projectId: project.id,
    });
    expect(reports).toEqual([
      { kind: 'worktree-listing', projectId: project.id, error: failure },
    ]);
  });

  it('reports a repository that is gone as unavailable without logging it', async () => {
    const { listing, reports } = reader(
      Object.assign(new Error('no such folder'), { code: 'ENOENT' }),
    );
    expect(await listing.list(project)).toEqual({
      kind: 'unavailable',
      projectId: project.id,
    });
    expect(reports).toEqual([]);
  });

  it('stops instead of reporting the project when its caller cancels', async () => {
    const cancelled = AbortSignal.abort(new Error('cancelled'));
    const { listing, reports } = reader(new Error('interrupted'));
    await expect(listing.list(project, cancelled)).rejects.toThrow('cancelled');
    expect(reports).toEqual([]);
  });
});
