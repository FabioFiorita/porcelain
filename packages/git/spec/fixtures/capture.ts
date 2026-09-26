import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = '/tmp/porcelain-fixtures';
const INSTANT = '2026-09-23T19:00:17-03:00';
const IDENTITY = 'T';
const ADDRESS = 't@example.invalid';
const COMMIT_FORMAT = '%H%x00%P%x00%an%x00%aI%x00%D%x00%s%x00%b';
const OUTPUT_BYTES = 64 * 1024 * 1024;

const fixtures = fileURLToPath(new URL('.', import.meta.url));

const environment = {
  PATH: process.env.PATH ?? '',
  HOME: ROOT,
  TZ: 'UTC',
  LC_ALL: 'C',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: IDENTITY,
  GIT_AUTHOR_EMAIL: ADDRESS,
  GIT_AUTHOR_DATE: INSTANT,
  GIT_COMMITTER_NAME: IDENTITY,
  GIT_COMMITTER_EMAIL: ADDRESS,
  GIT_COMMITTER_DATE: INSTANT,
};

const readConfig = [
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.untrackedCache=false',
  '-c',
  'core.quotePath=true',
  '-c',
  'diff.renameLimit=2000',
];

const statusArguments = [
  'status',
  '--porcelain=v2',
  '-z',
  '--branch',
  '--ahead-behind',
  '--untracked-files=all',
  '--ignore-submodules=dirty',
  '--find-renames=50%',
];

const diffArguments = [
  '--no-ext-diff',
  '--no-textconv',
  '--no-color',
  '--find-renames=50%',
  '--diff-algorithm=myers',
  '--no-indent-heuristic',
  '--unified=3',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--no-relative',
  '--raw',
  '-z',
  '--patch',
];

function git(cwd: string, args: readonly string[], input?: Buffer): Buffer {
  return execFileSync('git', args, {
    cwd,
    env: environment,
    input,
    maxBuffer: OUTPUT_BYTES,
  });
}

function read(cwd: string, args: readonly string[], input?: Buffer): Buffer {
  return git(cwd, [...readConfig, ...args], input);
}

function conflictingMerge(cwd: string, branch: string): void {
  const merged = spawnSync('git', ['merge', '-q', branch], {
    cwd,
    env: environment,
  });
  if (merged.status !== 1)
    throw new Error(`merging ${branch} was expected to conflict`);
}

function repository(name: string): string {
  git(ROOT, ['init', '-q', '-b', 'main', name]);
  return join(ROOT, name);
}

function put(checkout: string, path: string, content: string | Buffer): void {
  mkdirSync(dirname(join(checkout, path)), { recursive: true });
  writeFileSync(join(checkout, path), content);
}

function commit(checkout: string, ...message: readonly string[]): void {
  git(checkout, ['add', '-A']);
  git(checkout, ['commit', '-q', ...message.flatMap((part) => ['-m', part])]);
}

function reset(checkout: string): void {
  git(checkout, ['reset', '-q', '--hard']);
  git(checkout, ['clean', '-q', '-fd']);
}

function save(name: string, content: Buffer): void {
  const path = join(fixtures, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function nulOffset(output: Buffer, count: number): number {
  let offset = -1;
  for (let found = 0; found < count; found += 1) {
    offset = output.indexOf(0, offset + 1);
    if (offset === -1)
      throw new Error(`the output holds fewer than ${count} NUL bytes`);
  }
  return offset;
}

function cutAt(output: Buffer, text: string): Buffer {
  const offset = output.indexOf(text);
  if (offset === -1) throw new Error(`the output does not hold ${text}`);
  return output.subarray(0, offset);
}

function handEdited(output: Buffer, from: string, to: string): Buffer {
  const text = output.toString('latin1');
  if (!text.includes(from)) throw new Error(`the output does not hold ${from}`);
  return Buffer.from(text.replace(from, to), 'latin1');
}

function captureHistoryRepository(): void {
  const upstream = repository('upstream');
  put(upstream, 'a.txt', 'one\ntwo\nthree\nfour\nfive\n');
  put(upstream, 'b.txt', 'b\nb2\n');
  put(upstream, 'c.txt', 'c\n');
  put(upstream, 'logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  put(upstream, 'latin1.txt', Buffer.from('café\n', 'latin1'));
  symlinkSync('a.txt', join(upstream, 'link'));
  commit(upstream, 'base');
  git(ROOT, ['clone', '-q', 'upstream', 'repo']);
  const checkout = join(ROOT, 'repo');
  put(upstream, 'c.txt', 'c\nupstream one\n');
  commit(upstream, 'upstream one');
  put(upstream, 'c.txt', 'c\nupstream one\nupstream two\n');
  commit(upstream, 'upstream two', 'Body line');
  put(checkout, 'ahead.txt', 'ahead\n');
  commit(checkout, 'ahead');
  git(checkout, ['tag', 'v1.0']);
  git(checkout, ['fetch', '-q', 'origin']);

  git(checkout, ['mv', 'b.txt', 'renamed.txt']);
  const rename = read(checkout, ['diff', '--cached', ...diffArguments, '--']);
  save('diff/staged-rename.txt', rename);
  save('diff/rename-truncated.txt', rename.subarray(0, nulOffset(rename, 2)));

  put(checkout, 'a.txt', 'one\ntwo\nthree\nfour\nfive\nand more\n');
  put(checkout, 'new file.txt', 'new\n');
  git(checkout, ['add', 'new file.txt']);
  put(checkout, 'dir/inner.txt', 'inner\n');
  const working = read(checkout, statusArguments);
  save('status/working.txt', working);
  save('status/working-truncated.txt', working.subarray(0, -1));
  save(
    'status/working-malformed-hand-edited.txt',
    handEdited(
      working,
      '1 .M N... 100644 100644 100644',
      '1 .M N... 100644 10064 100644',
    ),
  );

  git(checkout, ['worktree', 'add', '-q', '-b', 'feature', '../feature']);
  git(checkout, ['worktree', 'add', '-q', '--detach', '../my detached']);
  git(checkout, ['worktree', 'lock', '--reason', 'on usb', '../my detached']);
  save(
    'worktrees/linked.txt',
    read(checkout, ['worktree', 'list', '--porcelain', '-z']),
  );
  git(checkout, ['worktree', 'unlock', '../my detached']);
  git(checkout, ['worktree', 'remove', '--force', '../my detached']);
  git(checkout, ['worktree', 'remove', '--force', '../feature']);
  git(checkout, ['branch', '-q', '-D', 'feature']);
  reset(checkout);

  put(checkout, 'a.txt', 'one\nTWO\nthree\nfour\nfive\nsix\nseven\n');
  save(
    'diff/unified-zero.txt',
    git(checkout, [
      '--literal-pathspecs',
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--unified=0',
      '--',
      'a.txt',
    ]),
  );
  reset(checkout);

  put(checkout, 'b.txt', 'b\nb2\nb3\n');
  chmodSync(join(checkout, 'c.txt'), 0o755);
  unlinkSync(join(checkout, 'link'));
  put(checkout, 'link', 'now a file\n');
  put(checkout, 'logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x02]));
  const worktree = read(checkout, ['diff', ...diffArguments, '--']);
  save('diff/worktree.txt', worktree);
  save('diff/worktree-truncated.txt', cutAt(worktree, 'diff --git a/c.txt'));
  save(
    'diff/raw-truncated.txt',
    worktree.subarray(0, nulOffset(worktree, 1) + 4),
  );
  const firstRecord = worktree
    .subarray(0, nulOffset(worktree, 2) + 1)
    .toString('latin1');
  save(
    'diff/worktree-malformed-hand-edited.txt',
    handEdited(worktree, firstRecord, ''),
  );
  reset(checkout);

  put(checkout, 'latin1.txt', Buffer.from('cafés\n', 'latin1'));
  save('diff/latin1.txt', read(checkout, ['diff', ...diffArguments, '--']));
  reset(checkout);

  git(checkout, ['merge', '-q', '--no-ff', '-m', 'merge', 'origin/main']);
  const page = read(checkout, [
    'log',
    '--topo-order',
    '-z',
    '--max-count=6',
    '--decorate-refs=refs/*',
    `--format=${COMMIT_FORMAT}`,
    '--',
  ]);
  save('log/page.txt', page);
  save('log/page-truncated.txt', page.subarray(0, nulOffset(page, 12) + 1));
  save(
    'history/show-commit.txt',
    read(checkout, [
      'show',
      '--raw',
      '-z',
      '--no-textconv',
      '--no-ext-diff',
      '--no-color',
      '--find-renames=50%',
      '--diff-merges=first-parent',
      `--format=${COMMIT_FORMAT}`,
      'HEAD',
      '--',
    ]),
  );
}

function captureConflict(): void {
  const checkout = repository('conflict');
  put(checkout, 'my file.txt', 'base\n');
  commit(checkout, 'base');
  git(checkout, ['checkout', '-q', '-b', 'other']);
  put(checkout, 'my file.txt', 'other\n');
  commit(checkout, 'other');
  git(checkout, ['checkout', '-q', 'main']);
  put(checkout, 'my file.txt', 'main\n');
  commit(checkout, 'main');
  git(checkout, ['checkout', '-q', '--detach']);
  save('status/detached.txt', read(checkout, statusArguments));
  git(checkout, ['checkout', '-q', 'main']);
  conflictingMerge(checkout, 'other');
  save('status/conflicted.txt', read(checkout, statusArguments));
}

function captureSubmodule(): void {
  const library = repository('lib');
  put(library, 'lib.txt', 'lib\n');
  commit(library, 'lib');
  const checkout = repository('super');
  git(checkout, [
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    '-q',
    '../lib',
    'vendor/lib',
  ]);
  commit(checkout, 'add lib');
  const vendored = join(checkout, 'vendor/lib');
  put(vendored, 'lib.txt', 'lib moved\n');
  commit(vendored, 'move lib');
  save('status/submodule.txt', read(checkout, statusArguments));
}

function captureEmptyAndBare(): void {
  save('status/initial.txt', read(repository('initial'), statusArguments));
  git(ROOT, ['init', '-q', '--bare', 'bare.git']);
  save(
    'worktrees/bare.txt',
    read(join(ROOT, 'bare.git'), ['worktree', 'list', '--porcelain', '-z']),
  );
}

function captureFilters(): void {
  const attributed = repository('attributes');
  put(attributed, '.gitattributes', '*.bin filter=lfs\n');
  put(attributed, 'README.md', 'readme\n');
  put(attributed, 'model.bin', 'model\n');
  git(attributed, ['add', '-A']);
  const paths = read(attributed, ['ls-files', '-z']);
  save(
    'attributes/filter.txt',
    read(attributed, ['check-attr', '-z', '--stdin', 'filter'], paths),
  );

  const filtered = repository('filters');
  git(filtered, ['config', 'filter.lfs.clean', 'git-lfs clean -- %f']);
  git(filtered, ['config', 'filter.lfs.smudge', 'git-lfs smudge -- %f']);
  git(filtered, ['config', 'filter.lfs.required', 'true']);
  git(filtered, ['config', 'filter.empty.clean', '']);
  git(filtered, ['config', 'filter.My.Driver.process', 'run']);
  appendFileSync(
    join(filtered, '.git/config'),
    '[remote "origin"]\n\tmirror\n',
  );
  save('config/filters.txt', read(filtered, ['config', '--null', '--list']));
  save(
    'config/plain.txt',
    read(repository('plain'), ['config', '--null', '--list']),
  );
}

rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });
try {
  captureHistoryRepository();
  captureConflict();
  captureSubmodule();
  captureEmptyAndBare();
  captureFilters();
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}
