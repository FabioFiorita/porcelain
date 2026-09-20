import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DiscoveryResult } from '@porcelain/git/dtos/discovery-result';
import { GitCommandError } from '@porcelain/git/errors/git-command-error';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import { identity } from '@porcelain/git/worktree-registry';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { ListableProject } from '../models/worktree.ts';
import { deriveWorktreeId } from '../models/worktree-id.ts';
import { LaunchLimit } from './launch-limit.ts';
import { SharedReads } from './shared-reads.ts';
import { WorktreeDirectory } from './worktree-directory.ts';

/**
 * A repository's directories, without Git: the administrative directory the
 * identity comes from, and a checkout that points back at it. Git is faked
 * here because what is under test is what the directory reads from the
 * filesystem between listings.
 */
async function repository(root: string, name: string) {
  const common = join(root, name, '.git');
  await mkdir(join(common, 'worktrees', 'feature'), { recursive: true });
  await writeFile(join(common, 'HEAD'), 'ref: refs/heads/main\n');
  const main = join(root, name);
  const linked = join(root, `${name}-feature`);
  const administrative = join(common, 'worktrees', 'feature');
  await mkdir(linked, { recursive: true });
  await writeFile(join(linked, '.git'), `gitdir: ${administrative}/.git\n`);
  await writeFile(join(administrative, 'gitdir'), `${join(linked, '.git')}\n`);
  await writeFile(join(administrative, 'HEAD'), 'ref: refs/heads/feature\n');
  return { common, main, linked, administrative };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-directory-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const places = await repository(root, 'atlas');
  const project: ListableProject = {
    id: 'project',
    commonDirectory: places.common,
    repositoryIdentity: 'atlas',
  };
  const listing = async (): Promise<DiscoveryResult> => ({
    repository: {
      commonDirectory: places.common,
      repositoryIdentity: 'atlas',
      worktrees: [
        {
          path: places.main,
          metadataIdentity: await identity(places.common),
          administrativeDirectory: places.common,
          main: true,
          branch: 'refs/heads/main',
          available: true,
        },
        {
          path: places.linked,
          metadataIdentity: await identity(places.administrative),
          administrativeDirectory: places.administrative,
          main: false,
          branch: 'refs/heads/feature',
          available: true,
        },
      ],
    },
    issues: [],
  });
  return { root, project, places, listing };
}

function directoryWith(
  project: ListableProject,
  listWorktrees: () => Promise<DiscoveryResult>,
) {
  const git = vi.fn<GitFactory>(() => ({
    listWorktrees,
    readOriginUrl: async () => null,
  }));
  return {
    git,
    directory: new WorktreeDirectory({
      git,
      reads: new SharedReads(),
      launches: new LaunchLimit(4),
      timeoutMs: 5_000,
      projects: () => [project],
    }),
  };
}

describe('Worktree directory', () => {
  it('follows a moved checkout and a branch switch without asking Git again', async () => {
    const f = await fixture();
    const { git, directory } = directoryWith(f.project, f.listing);
    const listed = await directory.list(f.project);
    const linked = listed.worktrees[1];
    if (!linked) throw new Error('Missing fixture worktree');
    expect(git).toHaveBeenCalledTimes(1);
    // `git worktree move` rewrites the pointer and leaves the administrative
    // directory alone; a branch switch rewrites its HEAD. Both are what the
    // id has to survive, and neither is worth a Git process to notice.
    const moved = join(f.root, 'moved-feature');
    await rename(f.places.linked, moved);
    await writeFile(
      join(f.places.administrative, 'gitdir'),
      `${join(moved, '.git')}\n`,
    );
    await writeFile(join(moved, '.git'), `gitdir: ${f.places.administrative}`);
    await writeFile(
      join(f.places.administrative, 'HEAD'),
      'ref: refs/heads/renamed\n',
    );
    expect(await directory.resolve(linked.id)).toMatchObject({
      id: linked.id,
      path: moved,
      branch: 'refs/heads/renamed',
      available: true,
    });
    expect(git).toHaveBeenCalledTimes(1);
  });

  it('keeps an id whose checkout another repository has taken, but not as readable', async () => {
    const f = await fixture();
    const { directory } = directoryWith(f.project, f.listing);
    const listed = await directory.list(f.project);
    const linked = listed.worktrees[1];
    if (!linked) throw new Error('Missing fixture worktree');
    // The pointer still names this path; only the checkout can say it no
    // longer belongs here.
    await writeFile(
      join(f.places.linked, '.git'),
      'gitdir: /somewhere/else/.git\n',
    );
    expect(await directory.resolve(linked.id)).toMatchObject({
      id: linked.id,
      available: false,
    });
  });

  it('reports a listing short of an identity as incomplete', async () => {
    const f = await fixture();
    const short = async () => {
      const result = await f.listing();
      const linked = result.repository.worktrees[1];
      if (linked) linked.metadataIdentity = null;
      return result;
    };
    const { directory } = directoryWith(f.project, short);
    const listed = await directory.list(f.project);
    // The worktree Git printed has no id to be listed under. Calling this
    // listing complete would tell the cleanup that worktree is gone.
    expect(listed.worktrees).toHaveLength(1);
    expect(listed.complete).toBe(false);
    expect((await directory.list(f.project)).failure).toBeUndefined();
  });

  it('refuses to call an id missing while a repository could not be read', async () => {
    const f = await fixture();
    // Git ran and reported a numeric exit: the repository is unreadable, not
    // the machine. That is data the sidebar shows, not a fault to raise.
    const unreadable = () =>
      Promise.reject(
        new GitCommandError(
          f.places.common,
          ['worktree', 'list'],
          Object.assign(new Error('not a git repository'), { code: 128 }),
        ),
      );
    const { directory } = directoryWith(f.project, unreadable);
    const listing = await directory.list(f.project);
    expect(listing.complete).toBe(false);
    expect(listing.failure).toBeInstanceOf(GitCommandError);
    // Not found would be a claim about a repository nobody could read.
    await expect(
      directory.resolve(deriveWorktreeId('project', 'unknown')),
    ).rejects.toBeInstanceOf(RepositoryIdentityMismatchError);
  });

  it('launches no more Git processes at once than the limit allows', async () => {
    const f = await fixture();
    const projects = Array.from({ length: 6 }, (_, index) => ({
      ...f.project,
      id: `project-${index}`,
    }));
    let running = 0;
    let peak = 0;
    const release = Promise.withResolvers<void>();
    const git = vi.fn<GitFactory>(() => ({
      listWorktrees: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await release.promise;
        running -= 1;
        return f.listing();
      },
      readOriginUrl: async () => null,
    }));
    const directory = new WorktreeDirectory({
      git,
      reads: new SharedReads(),
      launches: new LaunchLimit(2),
      timeoutMs: 5_000,
      projects: () => projects,
    });
    const listed = directory.listAll();
    // Six projects, two permits: the rest wait for a process to finish rather
    // than adding to the number of Git children on the machine.
    await new Promise((tick) => setTimeout(tick, 10));
    expect(peak).toBe(2);
    release.resolve();
    expect(await listed).toHaveLength(6);
    expect(git).toHaveBeenCalledTimes(6);
    expect(peak).toBe(2);
  });

  it('joins a listing already in flight without taking a second permit', async () => {
    const f = await fixture();
    const release = Promise.withResolvers<void>();
    const git = vi.fn<GitFactory>(() => ({
      listWorktrees: async () => {
        await release.promise;
        return f.listing();
      },
      readOriginUrl: async () => null,
    }));
    const directory = new WorktreeDirectory({
      git,
      reads: new SharedReads(),
      // One permit: a joining caller that took one would deadlock here.
      launches: new LaunchLimit(1),
      timeoutMs: 5_000,
      projects: () => [f.project],
    });
    const first = directory.list(f.project);
    const second = directory.list(f.project);
    release.resolve();
    expect((await first).worktrees).toHaveLength(2);
    expect((await second).worktrees).toHaveLength(2);
    expect(git).toHaveBeenCalledTimes(1);
  });

  it('forgets a project rather than answering for it after removal', async () => {
    const f = await fixture();
    const { directory } = directoryWith(f.project, f.listing);
    const listed = await directory.list(f.project);
    const linked = listed.worktrees[1];
    if (!linked) throw new Error('Missing fixture worktree');
    expect(directory.repositoryOf(linked.id)).toBe('atlas');
    directory.forget(f.project.id);
    // The checkout is untouched on disk, so only forgetting it stops the id
    // from resolving to a project that no longer exists.
    expect(directory.repositoryOf(linked.id)).toBeNull();
  });
});
