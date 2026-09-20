import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import {
  claimDirectory,
  pruneAbandoned,
  removeTree,
} from './helpers/playground-runs.ts';
import { seedPlaygroundProject } from './helpers/seed-playground-project.ts';
import {
  ensureSyntheticBase,
  extractBallast,
} from './helpers/synthetic-base.ts';
import {
  agentTasks,
  seedSyntheticChanges,
} from './helpers/synthetic-changes.ts';
import { mix } from './helpers/synthetic-content.ts';
import {
  type PlaygroundProfileName,
  playgroundProfiles,
  type SyntheticShape,
} from './profiles.ts';

type PlaygroundWorktree = {
  path: string;
  branch: string;
  role: 'main' | 'review' | 'agent';
};

const runPrefix = 'porcelain-playground-';

/** Removes a run, including worktrees with installed dependency ballast. */
export const removePlayground = removeTree;

/** Waits for every task, then fails with the first failure, so cleanup never races a child. */
async function settled(tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
}

type PlaygroundOptions = {
  profile?: PlaygroundProfileName;
  /** Shared root for generated base repositories (default `<parentDirectory>/.cache`). */
  cacheDirectory?: string;
  /** Aborting stops Git, fast-import and tar children and removes the run. */
  signal?: AbortSignal;
};

/** Creates a disposable playground run for a named profile (default `fixture`). */
export async function createPlayground(
  parentDirectory = tmpdir(),
  options: PlaygroundOptions = {},
) {
  const profile = options.profile ?? 'fixture';
  return createProfilePlayground(
    parentDirectory,
    profile,
    playgroundProfiles[profile].synthetic,
    options,
  );
}

/** Specs use this to run the synthetic generator with small shapes. */
export async function createProfilePlayground(
  parentDirectory: string,
  profile: PlaygroundProfileName,
  shape: SyntheticShape | undefined,
  options: Omit<PlaygroundOptions, 'profile'> = {},
) {
  const { signal } = options;
  await mkdir(parentDirectory, { recursive: true });
  // Best effort: runs left behind by killed processes go while this one is built.
  const pruning = pruneAbandoned(parentDirectory, (name) =>
    name.startsWith(runPrefix),
  ).catch(() => {});
  const root = await mkdtemp(join(parentDirectory, runPrefix));
  try {
    await claimDirectory(root);
    const bin = await createIsolatedGit(root);
    const environment = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(GIT_|SSH_)/.test(key),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
    };
    const project = join(root, 'project');
    const worktree = join(root, 'review');
    const remote = join(root, 'origin.git');
    const execute = promisify(execFile);
    const git = async (...args: string[]) =>
      execute('git', args, {
        env: environment,
        maxBuffer: 64 << 20,
        ...(signal ? { signal } : {}),
      });
    const worktrees: PlaygroundWorktree[] = [
      { path: project, branch: 'main', role: 'main' },
      { path: worktree, branch: 'review', role: 'review' },
    ];
    if (!shape) await seedPlaygroundProject(project, worktree, remote, git);
    else {
      const base = await ensureSyntheticBase({
        cacheRoot: options.cacheDirectory ?? join(parentDirectory, '.cache'),
        name: profile,
        shape,
        environment,
        signal,
      });
      await seedPlaygroundProject(project, worktree, remote, git, base.remote);
      const agents = agentTasks(shape.agentChanges).map((task) => ({
        ...task,
        path: join(root, 'agents', task.name),
      }));
      await settled(
        agents.map((agent) =>
          git(
            '-C',
            project,
            '-c',
            'checkout.workers=0',
            'worktree',
            'add',
            '--quiet',
            '-b',
            agent.branch,
            agent.path,
            'main',
          ),
        ),
      );
      for (const agent of agents)
        worktrees.push({
          path: agent.path,
          branch: agent.branch,
          role: 'agent',
        });
      await settled([
        ...worktrees.map((entry) =>
          extractBallast(base.ballast, entry.path, signal),
        ),
        ...[
          {
            path: worktree,
            count: shape.reviewChanges,
            seed: mix(shape.seed, 41),
          },
          ...agents.map((agent, index) => ({
            path: agent.path,
            count: agent.changes,
            seed: mix(shape.seed, 43, index),
          })),
        ].map((entry) =>
          seedSyntheticChanges({
            worktree: entry.path,
            git: (...args) => git('-C', entry.path, ...args),
            manifest: base.manifest,
            count: entry.count,
            seed: entry.seed,
          }),
        ),
      ]);
      // Fresh checkouts leave racily clean index entries that Git re-hashes on
      // every status until the index is rewritten in a later second. Porcelain
      // reads without optional locks, so settle each index once here.
      await settled(worktrees.map((entry) => ageChanges(entry.path, git)));
      await sleep(1_020 - (Date.now() % 1_000), undefined, { signal });
      await settled(
        worktrees.map((entry) =>
          git('-C', entry.path, 'update-index', '-q', '--refresh'),
        ),
      );
    }
    await pruning;
    return {
      root,
      project,
      worktree,
      remote,
      reviewCommitOid: (
        await git('-C', worktree, 'rev-parse', 'HEAD')
      ).stdout.trim(),
      environment,
      dataDirectory: join(root, 'state'),
      profile,
      worktrees,
    };
  } catch (error) {
    await settled([pruning, removeTree(root)]);
    throw error;
  }
}

/**
 * Make a playground's changes look like work done a while ago.
 *
 * A file modified in the last couple of seconds is deliberately never trusted
 * for caching — a second write within the same timestamp tick would look
 * identical — so a playground built this instant measures every read as a
 * first read. That is not what working in a repository looks like, and it
 * makes the second reading of a worktree appear to cost as much as the first.
 */
async function ageChanges(
  worktree: string,
  git: (...args: string[]) => Promise<{ stdout: string }>,
) {
  const { stdout } = await git('-C', worktree, 'status', '--porcelain', '-z');
  const settled = new Date(Date.now() - 600_000);
  // `-z` records are `XY <path>`, and a rename or copy is followed by a second
  // bare record holding the path it came from. Reading that one as a status
  // line would age whatever its third character onwards happens to name.
  const records = stdout.split('\0').filter(Boolean);
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? '';
    if (record.length <= 3) continue;
    paths.push(record.slice(3));
    if (record.startsWith('R') || record.startsWith('C')) index += 1;
  }
  await Promise.all(
    paths.map((path) =>
      utimes(join(worktree, path), settled, settled).catch(() => undefined),
    ),
  );
}
