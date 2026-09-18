import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SyntheticManifest } from './synthetic-base.ts';
import {
  createRandom,
  extensions,
  type FileKind,
  isBinaryKind,
  mix,
  nouns,
  renderBlock,
  renderPng,
  renderText,
  type TextKind,
  verbs,
} from './synthetic-content.ts';

type Entry = { path: string; bytes: number; kind: FileKind };
type Operation =
  | 'small'
  | 'large'
  | 'staged'
  | 'both'
  | 'addStaged'
  | 'addUntracked'
  | 'delete'
  | 'deleteStaged'
  | 'rename'
  | 'renameEdit';

const operationWeights: [Operation, number][] = [
  ['small', 34],
  ['large', 10],
  ['staged', 12],
  ['both', 8],
  ['addStaged', 8],
  ['addUntracked', 7],
  ['delete', 8],
  ['deleteStaged', 5],
  ['rename', 5],
  ['renameEdit', 3],
];

function allocate(total: number) {
  const sum = operationWeights.reduce((value, [, weight]) => value + weight, 0);
  const counts = operationWeights.map(([operation, weight]) => ({
    operation,
    count: Math.floor((total * weight) / sum),
    rest: ((total * weight) / sum) % 1,
  }));
  let left = total - counts.reduce((value, entry) => value + entry.count, 0);
  for (const entry of [...counts].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    entry.count += 1;
    left -= 1;
  }
  return counts;
}

const extensionOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.indexOf('.');
  return dot > 0 ? name.slice(dot) : '';
};

/**
 * Leaves `count` entries in `git status --untracked-files=all`: text edits with
 * small and large hunks, additions, deletions, renames, staged and unstaged
 * states on one file and, for review-sized sets, a lockfile update, a multi-MB
 * file edit, binary changes and an untracked folder with many files.
 */
export async function seedSyntheticChanges(options: {
  worktree: string;
  git: (...args: string[]) => Promise<unknown>;
  manifest: Pick<SyntheticManifest, 'files' | 'packages' | 'lockfile'>;
  count: number;
  seed: number;
}) {
  const { worktree, count } = options;
  if (count <= 0) return;
  const random = createRandom(options.seed);
  const files: Entry[] = options.manifest.files.map(([path, bytes, kind]) => ({
    path,
    bytes,
    kind,
  }));
  const occupied = new Set(files.map((file) => file.path));
  const directories = new Set<string>();
  for (const file of files)
    for (
      let at = file.path.lastIndexOf('/');
      at > 0;
      at = file.path.lastIndexOf('/', at - 1)
    )
      directories.add(file.path.slice(0, at));
  const touched = new Set<string>();
  const staged: string[] = [];
  const afterStaging: (() => Promise<void>)[] = [];
  const editable = files.filter(
    (file) =>
      !isBinaryKind(file.kind) &&
      !['lock', 'ignore', 'package', 'tsconfig'].includes(file.kind) &&
      file.bytes < 200_000 &&
      file.path.includes('/'),
  );
  // Each existing file carries at most one change, so every change is one status entry.
  const take = (pool: Entry[], accept = (_: Entry) => true) => {
    const usable = (file: Entry) => !touched.has(file.path) && accept(file);
    let file: Entry | undefined;
    for (let attempt = 0; attempt < 40 && pool.length && !file; attempt += 1) {
      const candidate = pool[random.int(pool.length)] as Entry;
      if (usable(candidate)) file = candidate;
    }
    file ??= pool.find(usable);
    if (file) touched.add(file.path);
    return file;
  };
  const lines = (kind: TextKind, path: string, bytes: number) => {
    let text = '';
    while (text.length < bytes) text += renderBlock(kind, random, path);
    return text.replace(/\n$/, '').split('\n');
  };
  const edit = async (
    file: Entry,
    size: 'small' | 'large' | 'regions',
    path = file.path,
  ) => {
    const absolute = join(worktree, path);
    const content = (await readFile(absolute, 'utf8')).split('\n');
    const kind = file.kind as TextKind;
    if (size === 'small') {
      const at = random.int(Math.max(1, content.length - 1));
      content.splice(
        at,
        random.int(3),
        ...lines(kind, path, 60 + random.int(240)),
      );
    } else if (size === 'large') {
      const span = Math.max(
        3,
        Math.floor(content.length * (0.3 + 0.3 * random.next())),
      );
      const at = random.int(Math.max(1, content.length - span));
      content.splice(at, span, ...lines(kind, path, span * 40));
    } else
      for (let region = 12 + random.int(24); region > 0; region -= 1) {
        const span = 5 + random.int(40);
        const at = random.int(Math.max(1, content.length - span));
        content.splice(at, span, ...lines(kind, path, span * 35));
      }
    await writeFile(absolute, content.join('\n'));
  };
  const freshPath = (directory: string, extension: string) => {
    let path = '';
    while (!path || occupied.has(path))
      path = `${directory}/${random.pick(verbs)}-${random.pick(nouns)}${occupied.size % 7 === 0 ? `-${random.int(100)}` : ''}${extension}`;
    occupied.add(path);
    return path;
  };
  const create = async (path: string, kind: FileKind, bytes: number) => {
    await mkdir(dirname(join(worktree, path)), { recursive: true });
    await writeFile(
      join(worktree, path),
      kind === 'png'
        ? renderPng(mix(options.seed, occupied.size), 1, bytes)
        : renderText(
            { path, kind, bytes, seed: mix(options.seed, occupied.size) },
            0,
          ),
    );
  };
  let remaining = count;
  if (count >= 30) {
    // Review-sized change sets carry the heavy cases reviewers meet in practice.
    const lockfile = files.find(
      (file) => file.path === options.manifest.lockfile,
    );
    if (lockfile) {
      touched.add(lockfile.path);
      await edit(lockfile, 'regions');
      remaining -= 1;
    }
    const manifest = take(files.filter((file) => file.kind === 'package'));
    if (manifest) {
      const absolute = join(worktree, manifest.path);
      const text = await readFile(absolute, 'utf8');
      await writeFile(
        absolute,
        text.replace(
          /"version": "([^"]+)"/,
          (_, value: string) => `"version": "${value}-next.${random.int(9)}"`,
        ),
      );
      staged.push(manifest.path);
      remaining -= 1;
    }
    const huge = files
      .filter(
        (file) =>
          file.bytes >= 1_000_000 &&
          !isBinaryKind(file.kind) &&
          file.kind !== 'lock',
      )
      .sort((a, b) => b.bytes - a.bytes)[0];
    if (huge) {
      touched.add(huge.path);
      await edit(huge, 'regions');
      remaining -= 1;
    }
    const image = take(files.filter((file) => file.kind === 'png'));
    if (image) {
      await writeFile(
        join(worktree, image.path),
        renderPng(mix(options.seed, 97), 1, image.bytes),
      );
      remaining -= 1;
      await create(
        freshPath(dirname(image.path), '.png'),
        'png',
        4_000 + random.int(40_000),
      );
      remaining -= 1;
    }
  }
  const folderSize =
    count >= 30
      ? Math.max(5, Math.min(80, Math.round(count * 0.15)))
      : count >= 10
        ? 3
        : 0;
  const home =
    options.manifest.packages[random.int(options.manifest.packages.length)];
  if (folderSize && home) {
    let folder = '';
    while (!folder || directories.has(folder))
      folder = `${home.root}/src/${random.pick(nouns)}-${random.pick(['next', 'v2', 'draft', 'experiment'])}`;
    const sections = ['components', 'hooks', '__tests__', 'utils'];
    for (let index = 0; index < folderSize; index += 1) {
      const kind: TextKind =
        index % 4 === 2 ? 'test' : index % 3 === 0 ? 'tsx' : 'ts';
      const directory =
        index < 2 ? folder : `${folder}/${sections[index % sections.length]}`;
      await create(
        freshPath(directory, extensions[kind]),
        kind,
        400 + random.int(6_000),
      );
    }
    remaining -= folderSize;
  }
  for (const { operation, count: planned } of allocate(Math.max(0, remaining)))
    for (let index = 0; index < planned; index += 1) {
      if (operation === 'addStaged' || operation === 'addUntracked') {
        const template = editable[random.int(editable.length)];
        if (!template) continue;
        const path = freshPath(
          dirname(template.path),
          extensionOf(template.path),
        );
        await create(
          path,
          template.kind,
          Math.max(200, Math.min(20_000, template.bytes)),
        );
        if (operation === 'addStaged') staged.push(path);
        continue;
      }
      const renaming = operation === 'rename' || operation === 'renameEdit';
      const file = take(editable, (entry) => !renaming || entry.bytes >= 2_000);
      if (!file) continue;
      if (operation === 'delete' || operation === 'deleteStaged') {
        await rm(join(worktree, file.path));
        if (operation === 'deleteStaged') staged.push(file.path);
      } else if (renaming) {
        const target = freshPath(dirname(file.path), extensionOf(file.path));
        await rename(join(worktree, file.path), join(worktree, target));
        if (operation === 'renameEdit') await edit(file, 'small', target);
        staged.push(file.path, target);
      } else {
        await edit(file, operation === 'large' ? 'large' : 'small');
        if (operation === 'staged' || operation === 'both')
          staged.push(file.path);
        if (operation === 'both') afterStaging.push(() => edit(file, 'small'));
      }
    }
  for (let index = 0; index < staged.length; index += 200)
    await options.git('add', '-A', '--', ...staged.slice(index, index + 200));
  for (const change of afterStaging) await change();
}

export function agentTasks(changes: readonly number[]) {
  const names = {
    idle: ['investigate-flaky-sync', 'explore-search-latency'],
    focused: [
      'retry-sync-backoff',
      'fix-invoice-rounding',
      'tidy-report-exports',
    ],
    sweeping: ['migrate-date-helpers', 'rename-billing-models'],
  };
  const used = new Set<string>();
  return changes.map((count, index) => {
    const pool =
      count === 0 ? names.idle : count < 100 ? names.focused : names.sweeping;
    const name =
      pool.find((value) => !used.has(value)) ?? `agent-task-${index + 1}`;
    used.add(name);
    return { name, branch: `agent/${name}`, changes: count };
  });
}
