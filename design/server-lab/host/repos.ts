// Local repositories the lab may observe read-only, and their aggregate shape.
// Measurements return numbers only: no file names or contents leave here.
import { execFile } from 'node:child_process';
import { lstat, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoShape } from './protocol.ts';

const run = promisify(execFile);
const env = {
  ...process.env,
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0',
};

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await run('git', ['-C', cwd, ...args], {
    env,
    maxBuffer: 1 << 30,
    encoding: 'utf8',
  });
  return stdout;
}

export function realRoots() {
  const configured = process.env.LAB_REAL_ROOTS;
  return (
    configured ? configured.split(':') : [join(homedir(), 'code')]
  ).filter(Boolean);
}

export async function listRepositories() {
  const repositories: { name: string; path: string }[] = [];
  for (const root of realRoots()) {
    let entries: string[] = [];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const name of entries.sort()) {
      const path = join(root, name);
      try {
        if (!(await stat(path)).isDirectory()) continue;
        await lstat(join(path, '.git'));
        repositories.push({ name, path });
      } catch {}
    }
  }
  return repositories;
}

const percentile = (sorted: number[], p: number) =>
  sorted.length
    ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0)
    : 0;

export async function measureRepository(
  path: string,
  options: { workingTree?: boolean } = {},
): Promise<RepoShape> {
  const started = performance.now();
  const files = (await git(path, 'ls-files', '-z')).split('\0').filter(Boolean);
  const sizes: number[] = [];
  const depths: number[] = [];
  const directories = new Set<string>();
  let over100Kb = 0;
  let over1Mb = 0;
  let total = 0;
  let packages = 0;
  for (let index = 0; index < files.length; index += 256) {
    const batch = files.slice(index, index + 256);
    const measured = await Promise.all(
      batch.map((file) =>
        lstat(join(path, file)).then(
          (info) => info.size,
          () => 0,
        ),
      ),
    );
    for (const [offset, size] of measured.entries()) {
      const file = batch[offset] as string;
      sizes.push(size);
      total += size;
      if (size > 1e5) over100Kb++;
      if (size > 1e6) over1Mb++;
      if (file.endsWith('package.json')) packages++;
      const parts = file.split('/');
      depths.push(parts.length - 1);
      for (let depth = 1; depth < parts.length; depth++)
        directories.add(parts.slice(0, depth).join('/'));
    }
  }
  sizes.sort((a, b) => a - b);
  depths.sort((a, b) => a - b);
  const binaryFiles = (await git(path, 'ls-files', '--eol'))
    .split('\n')
    .filter((line) => line.startsWith('i/-text')).length;
  const worktrees = (await git(path, 'worktree', 'list', '--porcelain'))
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice(9));
  const changedEntries = await Promise.all(
    worktrees.map((worktree) =>
      git(
        worktree,
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
      ).then(
        (output) => output.split('\0').filter(Boolean).length,
        () => -1,
      ),
    ),
  );
  const count = async (...args: string[]) =>
    (await git(path, ...args)).split('\n').filter(Boolean).length;
  const shape: RepoShape = {
    trackedFiles: files.length,
    directories: directories.size,
    trackedMb: +(total / 1e6).toFixed(1),
    sizeP50: percentile(sizes, 0.5),
    sizeP90: percentile(sizes, 0.9),
    sizeP99: percentile(sizes, 0.99),
    sizeMax: sizes.at(-1) ?? 0,
    over100Kb,
    over1Mb,
    binaryFiles,
    depthP50: percentile(depths, 0.5),
    depthMax: depths.at(-1) ?? 0,
    packages,
    commits: Number(
      (await git(path, 'rev-list', '--count', 'HEAD').catch(() => '0')).trim(),
    ),
    localBranches: await count(
      'for-each-ref',
      '--format=%(refname)',
      'refs/heads/',
    ),
    remoteBranches: await count(
      'for-each-ref',
      '--format=%(refname)',
      'refs/remotes/',
    ),
    worktrees: worktrees.length,
    changedEntries,
    measuredMs: 0,
  };
  if (options.workingTree) {
    let total = 0;
    for (const worktree of worktrees) total += await countFiles(worktree);
    shape.workingTreeFiles = total;
  }
  shape.measuredMs = Math.round(performance.now() - started);
  return shape;
}

async function countFiles(root: string) {
  let files = 0;
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop() as string;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name !== '.git') pending.push(join(directory, entry.name));
      } else files++;
    }
  }
  return files;
}
