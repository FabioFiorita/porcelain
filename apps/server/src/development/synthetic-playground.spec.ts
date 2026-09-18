import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
  createPlayground,
  createProfilePlayground,
  removePlayground,
} from './create-playground.ts';
import { generatorVersion } from './helpers/synthetic-base.ts';
import { type SyntheticShape, syntheticTargets } from './profiles.ts';

const shape: SyntheticShape = {
  seed: 7,
  files: 60,
  directories: 24,
  packages: 4,
  medianDepth: 4.5,
  maxDepth: 6,
  medianFileBytes: 1_500,
  p90FileBytes: 6_000,
  largeFiles: 1,
  multiMegabyteFiles: 1,
  maxFileBytes: 1_100_000,
  lockfileBytes: 40_000,
  binaryFiles: 3,
  commits: 40,
  mergeShare: 0.1,
  largeCommits: 1,
  lockfileUpdates: 2,
  historyDays: 30,
  remoteBranches: 3,
  reviewChanges: 30,
  agentChanges: [12],
  ignoredFiles: 200,
};
const targets = syntheticTargets(shape);

async function disposableParent() {
  const parent = await mkdtemp(join(tmpdir(), 'porcelain-synthetic-'));
  onTestFinished(() => removePlayground(parent));
  return parent;
}

function gitIn(environment: NodeJS.ProcessEnv) {
  return async (cwd: string, ...args: string[]) =>
    (
      await promisify(execFile)('git', ['-C', cwd, ...args], {
        env: environment,
        maxBuffer: 64 << 20,
      })
    ).stdout;
}

/** `git status --porcelain=v1 -z` entries; a rename carries its source as an extra field. */
function statusEntries(output: string) {
  const fields = output.split('\0').filter(Boolean);
  const codes: string[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] as string;
    codes.push(field.slice(0, 2));
    if (/^[RC]/.test(field)) index += 1;
  }
  return codes;
}

describe('Synthetic playground profiles', () => {
  it('generates history beneath the Fieldnotes story with worktrees, review changes and ignored dependencies', async () => {
    const parent = await disposableParent();
    const playground = await createProfilePlayground(parent, 'app', shape);
    const git = gitIn(playground.environment);
    const { project } = playground;
    expect(playground.profile).toBe('app');
    expect(
      playground.worktrees.map(({ branch, role }) => [branch, role]),
    ).toEqual([
      ['main', 'main'],
      ['review', 'review'],
      [expect.stringMatching(/^agent\//), 'agent'],
    ]);
    const listed = await git(project, 'worktree', 'list', '--porcelain');
    for (const worktree of playground.worktrees)
      expect(listed).toContain(`branch refs/heads/${worktree.branch}`);
    expect(
      (await git(project, 'ls-files')).split('\n').filter(Boolean),
    ).toHaveLength(targets.trackedFiles);
    expect(Number(await git(project, 'rev-list', '--count', 'main'))).toBe(
      targets.commits,
    );
    expect(
      Number(await git(project, 'rev-list', '--merges', '--count', 'main')),
    ).toBeGreaterThan(0);
    const remotes = (
      await git(
        project,
        'for-each-ref',
        '--format=%(refname)',
        'refs/remotes/origin',
      )
    )
      .split('\n')
      .filter((ref) => ref && !ref.endsWith('/HEAD'));
    expect(remotes).toHaveLength(targets.remoteBranches);
    // The curated story stays the newest history on main.
    expect(
      (await git(project, 'log', '-5', '--format=%s', 'main'))
        .trim()
        .split('\n'),
    ).toEqual([
      'Prepare internal release notes',
      'Build responsive launch board',
      'Serve task data through a local JSON endpoint',
      'Model launch tasks and completion summaries',
      'Plan Fieldnotes launch workspace',
    ]);
    const synthetic = Number(
      await git(project, 'log', '-1', '--format=%ct', 'main~5'),
    );
    const story = Number(
      await git(project, 'log', '-1', '--format=%ct', 'main~4'),
    );
    expect(synthetic).toBeLessThan(story);
    expect(await git(project, 'show', 'main:.gitignore')).toMatch(
      /node_modules\/[\s\S]*\.cache\//,
    );
    const review = statusEntries(
      await git(
        playground.worktree,
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
      ),
    );
    expect(review).toHaveLength(targets.changedEntries.review);
    expect(new Set(review)).toEqual(
      new Set(['MM', 'M ', ' M', 'A ', ' D', 'D ', 'R ', '??']),
    );
    const reviewStatus = await git(
      playground.worktree,
      'status',
      '--porcelain',
    );
    expect(reviewStatus).toContain('MM README.md');
    expect(reviewStatus).toContain(
      'R  docs/launch-checklist.md -> docs/release-checklist.md',
    );
    expect(reviewStatus).toContain(' M pnpm-lock.yaml');
    expect(await git(playground.worktree, 'diff', '--numstat')).toMatch(
      /^-\t-\t.*\.png$/m,
    );
    expect(await git(playground.worktree, 'stash', 'list')).toContain(
      'Experiment with active task filtering',
    );
    const agent = playground.worktrees[2]?.path as string;
    expect(
      statusEntries(
        await git(
          agent,
          'status',
          '--porcelain=v1',
          '-z',
          '--untracked-files=all',
        ),
      ),
    ).toHaveLength(shape.agentChanges[0] as number);
    for (const { path } of playground.worktrees) {
      expect(
        await git(path, 'status', '--porcelain', '--untracked-files=all'),
      ).not.toMatch(/node_modules|\/dist\//);
      expect(await git(path, 'status', '--porcelain', '--ignored')).toContain(
        '!! node_modules/',
      );
      const ignored = (
        await git(
          path,
          'ls-files',
          '--others',
          '--ignored',
          '--exclude-standard',
        )
      )
        .split('\n')
        .filter((file) => file && !file.startsWith('.cache/'));
      expect(ignored).toHaveLength(shape.ignoredFiles);
      expect(ignored.some((file) => /^[^/]+\/[^/]+\/dist\//.test(file))).toBe(
        true,
      );
    }
    const image = (await git(project, 'ls-files', '*.png')).split(
      '\n',
    )[0] as string;
    const header = (await readFile(join(project, image))).subarray(0, 8);
    expect(header).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }, 30_000);

  it('reuses one cached base across runs, including runs that start together', async () => {
    const parent = await disposableParent();
    const cache = join(parent, 'shared-cache');
    const entry = join(cache, `app-v${generatorVersion}`);
    const exited = spawn(process.execPath, ['-e', '']);
    await once(exited, 'close');
    const leftover = async (name: string, pid?: number) => {
      await mkdir(join(cache, name), { recursive: true });
      if (pid)
        await writeFile(
          join(cache, name, 'owner.json'),
          JSON.stringify({ pid, host: hostname() }),
        );
    };
    // Killed builds, swapped-out bases and other generator versions go; live builds stay.
    await leftover(`app-v${generatorVersion}.tmp-killed`, exited.pid);
    await leftover(`monorepo-v${generatorVersion + 1}.tmp-live`, process.pid);
    await leftover(`app-v${generatorVersion}.old-1234`);
    await leftover(`app-v${generatorVersion - 1}`);
    await leftover('notes');
    const runs = await Promise.all([
      createProfilePlayground(parent, 'app', shape, { cacheDirectory: cache }),
      createProfilePlayground(parent, 'app', shape, { cacheDirectory: cache }),
    ]);
    expect((await readdir(cache)).sort()).toEqual(
      [
        basename(entry),
        `monorepo-v${generatorVersion + 1}.tmp-live`,
        'notes',
      ].sort(),
    );
    expect(await readdir(entry)).not.toContain('owner.json');
    const manifest = await stat(join(entry, 'manifest.json'));
    // Change counts apply per run, so they reuse the same base.
    const extra = await createProfilePlayground(
      parent,
      'app',
      { ...shape, reviewChanges: 10, agentChanges: [5, 0] },
      { cacheDirectory: cache },
    );
    runs.push(extra);
    expect((await stat(join(entry, 'manifest.json'))).ino).toBe(manifest.ino);
    expect(extra.worktrees).toHaveLength(4);
    expect(
      (
        await gitIn(extra.environment)(
          extra.worktree,
          'status',
          '--porcelain=v1',
          '-z',
          '--untracked-files=all',
        )
      )
        .split('\0')
        .filter((field) => /^.. /.test(field)).length,
    ).toBeGreaterThan(10);
    const tips = await Promise.all(
      runs.map((run) =>
        gitIn(run.environment)(run.project, 'rev-parse', 'main~5'),
      ),
    );
    expect(new Set(tips).size).toBe(1);
    // Changing the shape without a version bump replaces the outdated base.
    const smaller = await createProfilePlayground(
      parent,
      'app',
      { ...shape, commits: 30, agentChanges: [] },
      { cacheDirectory: cache },
    );
    expect(
      Number(
        await gitIn(smaller.environment)(
          smaller.project,
          'rev-list',
          '--count',
          'main',
        ),
      ),
    ).toBe(35);
    expect(smaller.worktrees).toHaveLength(2);
    expect((await readdir(cache)).sort()).toEqual(
      [
        basename(entry),
        `monorepo-v${generatorVersion + 1}.tmp-live`,
        'notes',
      ].sort(),
    );
    await Promise.all(
      [...runs, smaller].map((run) => removePlayground(run.root)),
    );
    expect((await readdir(parent)).sort()).toEqual(['shared-cache']);
  }, 60_000);

  it('prunes runs whose owner exited but keeps live, legacy and foreign runs and the cache', async () => {
    const parent = await disposableParent();
    const exited = spawn(process.execPath, ['-e', '']);
    await once(exited, 'close');
    const run = async (
      name: string,
      owner?: { pid: unknown; host: string },
    ) => {
      await mkdir(join(parent, name, 'project'), { recursive: true });
      if (owner)
        await writeFile(
          join(parent, name, 'owner.json'),
          JSON.stringify(owner),
        );
    };
    await run('porcelain-playground-exited', {
      pid: exited.pid,
      host: hostname(),
    });
    await run('porcelain-playground-live', {
      pid: process.pid,
      host: hostname(),
    });
    await run('porcelain-playground-legacy');
    await run('porcelain-playground-foreign', {
      pid: exited.pid,
      host: `${hostname()}-other`,
    });
    await run('porcelain-playground-unreadable', {
      pid: 'unknown',
      host: hostname(),
    });
    await mkdir(join(parent, '.cache', `app-v${generatorVersion}`), {
      recursive: true,
    });
    const playground = await createPlayground(parent);
    onTestFinished(() => removePlayground(playground.root));
    expect((await readdir(parent)).sort()).toEqual(
      [
        '.cache',
        basename(playground.root),
        'porcelain-playground-foreign',
        'porcelain-playground-legacy',
        'porcelain-playground-live',
        'porcelain-playground-unreadable',
      ].sort(),
    );
    expect(
      JSON.parse(await readFile(join(playground.root, 'owner.json'), 'utf8')),
    ).toEqual({
      pid: process.pid,
      host: hostname(),
    });
    await removePlayground(playground.root);
    await removePlayground(join(parent, 'missing'));
    expect(await readdir(parent)).not.toContain(basename(playground.root));
  });

  it('removes the run and the partial base when generation fails', async () => {
    const parent = await disposableParent();
    const cache = join(parent, 'cache');
    await expect(
      createProfilePlayground(
        parent,
        'app',
        { ...shape, lockfileBytes: Number.NaN },
        { cacheDirectory: cache },
      ),
    ).rejects.toThrow('Invalid array length');
    expect(await readdir(parent)).toEqual(['cache']);
    expect(await readdir(cache)).toEqual([]);
  });
});
