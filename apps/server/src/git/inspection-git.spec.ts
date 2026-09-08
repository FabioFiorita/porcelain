import { execFileSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type {
  GitOrdinaryChange,
  GitStatusObservation,
} from './dtos/git-status.ts';
import { InspectionLimitError } from './errors/inspection-limit-error.ts';
import { RepositoryIdentityMismatchError } from './errors/repository-identity-mismatch-error.ts';
import { UnsupportedGitFiltersError } from './errors/unsupported-git-filters-error.ts';
import { UnsupportedPathEncodingError } from './errors/unsupported-path-encoding-error.ts';
import { InspectionGit } from './inspection-git.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-inspection-')),
  );
  roots.push(root);
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  const metadata = await stat(join(checkout, '.git'), { bigint: true });
  const reader = new InspectionGit(
    checkout,
    `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`,
    `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`,
  );
  return { root, checkout, git, reader };
}

function selected(
  status: GitStatusObservation,
  scope: 'staged' | 'unstaged',
  path: string,
): GitOrdinaryChange {
  const change = status.changes.find(
    (entry) =>
      entry.scope === scope &&
      (entry.newPath === path || entry.oldPath === path),
  );
  if (!change || change.scope === 'untracked' || change.scope === 'unmerged')
    throw new Error('Missing fixture change');
  return change;
}

it('reads separate staged and unstaged rename changes without modifying the checkout or index', async () => {
  const { checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'old.txt'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  git('mv', 'old.txt', 'new.txt');
  await writeFile(join(checkout, 'new.txt'), 'base\nworking\n');
  const indexBefore = await readFile(join(checkout, '.git/index'));
  const refsBefore = git('show-ref');
  const status = await reader.readStatus();
  expect(status.changes).toEqual([
    {
      scope: 'staged',
      kind: 'renamed',
      oldPath: 'old.txt',
      newPath: 'new.txt',
      oldMode: '100644',
      newMode: '100644',
      supported: true,
    },
    {
      scope: 'unstaged',
      kind: 'modified',
      oldPath: 'new.txt',
      newPath: 'new.txt',
      oldMode: '100644',
      newMode: '100644',
      supported: true,
    },
  ]);
  expect(
    await reader.readDiff(selected(status, 'staged', 'new.txt')),
  ).toMatchObject({
    kind: 'metadata-only',
    patch: expect.stringContaining('rename from old.txt'),
  });
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'new.txt')),
  ).toMatchObject({ kind: 'text', patch: expect.stringContaining('+working') });
  expect(await readFile(join(checkout, '.git/index'))).toEqual(indexBefore);
  expect(git('show-ref')).toEqual(refsBefore);
  expect(await readFile(join(checkout, 'new.txt'), 'utf8')).toBe(
    'base\nworking\n',
  );
  expect((await reader.readStatus()).statusToken).toBe(status.statusToken);
});

it('handles unborn additions, individual untracked files and literal unusual names', async () => {
  const { checkout, git, reader } = await fixture();
  const name = ':(glob)*\n\tfile.txt';
  await writeFile(join(checkout, name), 'literal\n');
  await writeFile(join(checkout, 'other.txt'), 'other\n');
  await writeFile(join(checkout, '.gitignore'), 'ignored\n');
  await writeFile(join(checkout, 'ignored'), 'hidden\n');
  git('add', '.');
  await mkdir(join(checkout, 'untracked'));
  await writeFile(join(checkout, 'untracked', 'one'), 'one');
  const status = await reader.readStatus();
  expect(status.headOid).toBeNull();
  expect(status.changes).toContainEqual({
    scope: 'untracked',
    path: 'untracked/one',
  });
  expect(JSON.stringify(status.changes)).not.toContain('"ignored"');
  const diff = await reader.readDiff(selected(status, 'staged', name));
  expect(diff).toMatchObject({
    kind: 'text',
    patch: expect.stringContaining('+literal'),
  });
  if (diff.kind === 'text') expect(diff.patch).not.toContain('+other');
});

it('reports deletions, binary files, executable changes and symlink targets without reading target content', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'deleted'), 'remove me\n');
  await writeFile(join(checkout, 'binary'), Buffer.from([0, 1]));
  await writeFile(join(checkout, 'mode'), 'mode\n');
  await writeFile(join(checkout, 'link'), 'was regular\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await rm(join(checkout, 'deleted'));
  await writeFile(join(checkout, 'binary'), Buffer.from([0, 2]));
  await chmod(join(checkout, 'mode'), 0o755);
  await writeFile(join(root, 'secret'), 'must not appear in patch');
  await rm(join(checkout, 'link'));
  await symlink(join(root, 'secret'), join(checkout, 'link'));
  const status = await reader.readStatus();
  expect(selected(status, 'unstaged', 'deleted')).toMatchObject({
    newPath: null,
    kind: 'deleted',
  });
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'deleted')),
  ).toMatchObject({
    kind: 'text',
    patch: expect.stringContaining('-remove me'),
  });
  expect(await reader.readDiff(selected(status, 'unstaged', 'binary'))).toEqual(
    { kind: 'binary' },
  );
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'mode')),
  ).toMatchObject({
    kind: 'metadata-only',
    patch: expect.stringContaining('new mode 100755'),
  });
  expect(selected(status, 'unstaged', 'link')).toMatchObject({
    kind: 'type-changed',
    newMode: '120000',
  });
  expect(
    JSON.stringify(await reader.readDiff(selected(status, 'unstaged', 'link'))),
  ).not.toContain('must not appear');
});

it('lists real merge conflicts separately and refuses to inspect replaced checkout identity', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  git('checkout', '-b', 'other');
  await writeFile(join(checkout, 'file'), 'other\n');
  git('commit', '-am', 'other');
  git('checkout', 'main');
  await writeFile(join(checkout, 'file'), 'main\n');
  git('commit', '-am', 'main');
  expect(() => git('merge', 'other')).toThrow();
  expect((await reader.readStatus()).changes).toEqual([
    { scope: 'unmerged', path: 'file', conflict: 'UU' },
  ]);
  await rename(join(checkout, '.git'), join(root, 'original-metadata'));
  git('init', '-b', 'main');
  await expect(reader.readStatus()).rejects.toBeInstanceOf(
    RepositoryIdentityMismatchError,
  );
});

it('bounds status and diff output and reports unsupported text encoding without lossy decoding', async () => {
  const { checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'large'), 'small\n');
  await writeFile(join(checkout, 'encoding'), 'valid\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await writeFile(join(checkout, 'large'), 'x'.repeat(1024 * 1024));
  await writeFile(join(checkout, 'encoding'), Buffer.from([0xff, 0x0a]));
  const status = await reader.readStatus();
  expect(await reader.readDiff(selected(status, 'unstaged', 'large'))).toEqual({
    kind: 'omitted',
    reason: 'size-limit',
  });
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'encoding')),
  ).toEqual({ kind: 'omitted', reason: 'unsupported-encoding' });
  await Promise.all(
    Array.from({ length: 2001 }, (_, index) =>
      writeFile(join(checkout, `untracked-${index}`), ''),
    ),
  );
  await expect(reader.readStatus()).rejects.toBeInstanceOf(
    InspectionLimitError,
  );
});

it('rejects invalid UTF-8 filenames, preserves cancellation and disables configured diff programs', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  const marker = join(root, 'executed');
  const helper = join(root, 'helper');
  await writeFile(helper, `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, {
    mode: 0o755,
  });
  git('config', 'diff.external', helper);
  git('config', 'diff.fixture.textconv', helper);
  await writeFile(join(checkout, '.gitattributes'), 'file diff=fixture\n');
  await writeFile(join(checkout, 'file'), 'changed\n');
  const status = await reader.readStatus();
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'file')),
  ).toMatchObject({ kind: 'text', patch: expect.stringContaining('+changed') });
  await expect(stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(reader.readStatus(AbortSignal.abort())).rejects.toMatchObject({
    name: 'AbortError',
  });
  const oid = git('rev-parse', 'HEAD:file').toString().trim();
  execFileSync('git', ['-C', checkout, 'update-index', '-z', '--index-info'], {
    input: Buffer.concat([
      Buffer.from(`100644 ${oid}\t`),
      Buffer.from([0xff, 0]),
    ]),
  });
  await expect(reader.readStatus()).rejects.toBeInstanceOf(
    UnsupportedPathEncodingError,
  );
});

it('marks gitlinks unsupported without recursing into their diffs', async () => {
  const { checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base');
  git('add', '.');
  git('commit', '-m', 'base');
  const oid = git('rev-parse', 'HEAD').toString().trim();
  git('update-index', '--add', '--cacheinfo', `160000,${oid},module`);
  const status = await reader.readStatus();
  expect(selected(status, 'staged', 'module').supported).toBe(false);
  expect(await reader.readDiff(selected(status, 'staged', 'module'))).toEqual({
    kind: 'omitted',
    reason: 'unsupported-submodule',
  });
});

it('rejects linked worktrees redirected to a different common repository without replacing checkout metadata', async () => {
  const { root, checkout, git } = await fixture();
  await writeFile(join(checkout, 'file'), 'original\n');
  git('add', '.');
  git('commit', '-m', 'base');
  const linked = join(root, 'linked');
  git('worktree', 'add', '-b', 'linked', linked);
  const metadataPath = execFileSync('git', [
    '-C',
    linked,
    'rev-parse',
    '--absolute-git-dir',
  ])
    .toString()
    .trim();
  const metadata = await stat(metadataPath, { bigint: true });
  const common = await stat(join(checkout, '.git'), { bigint: true });
  const reader = new InspectionGit(
    linked,
    `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`,
    `${common.dev}:${common.ino}:${common.birthtimeNs}`,
  );
  await writeFile(join(linked, 'file'), 'working\n');
  const change = selected(await reader.readStatus(), 'unstaged', 'file');
  const clone = join(root, 'clone');
  git('clone', checkout, clone);
  await writeFile(join(metadataPath, 'commondir'), `${join(clone, '.git')}\n`);
  expect((await stat(metadataPath, { bigint: true })).ino).toBe(metadata.ino);
  await expect(reader.readStatus()).rejects.toBeInstanceOf(
    RepositoryIdentityMismatchError,
  );
  await expect(reader.readDiff(change)).rejects.toBeInstanceOf(
    RepositoryIdentityMismatchError,
  );
});

it('keeps selected file deletions separate from added descendants and preserves renames into a former file directory', async () => {
  const { checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'foo'), 'original\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await rm(join(checkout, 'foo'));
  await mkdir(join(checkout, 'foo'));
  await writeFile(join(checkout, 'foo/bar'), 'unrelated\n');
  git('add', '.');
  const deletion = await reader.readDiff(
    selected(await reader.readStatus(), 'staged', 'foo'),
  );
  expect(deletion).toMatchObject({
    kind: 'text',
    patch: expect.stringContaining('-original'),
  });
  expect(JSON.stringify(deletion)).not.toContain('foo/bar');
  await writeFile(join(checkout, 'foo/bar'), 'original\n');
  await writeFile(join(checkout, 'foo/other'), 'separate change\n');
  git('add', '.');
  const renamed = selected(await reader.readStatus(), 'staged', 'foo/bar');
  expect(renamed.kind).toBe('renamed');
  const renameDiff = await reader.readDiff(renamed);
  expect(renameDiff).toMatchObject({
    kind: 'metadata-only',
    patch: expect.stringContaining('rename to foo/bar'),
  });
  expect(JSON.stringify(renameDiff)).not.toContain('separate change');
});

it('selects exact Unicode and glob-like names even when a former file now contains descendants', async () => {
  const { checkout, git, reader } = await fixture();
  const names = ['é', '😀', '[x]', 'a\\b', ':(glob)*', 'space \n\tname'];
  for (const name of names) await writeFile(join(checkout, name), 'original\n');
  git('add', '.');
  git('commit', '-m', 'base');
  for (const name of names) {
    await rm(join(checkout, name));
    await mkdir(join(checkout, name));
    await writeFile(join(checkout, name, 'child'), 'descendant\n');
  }
  git('add', '.');
  const status = await reader.readStatus();
  for (const name of names) {
    const diff = await reader.readDiff(selected(status, 'staged', name));
    expect(diff).toMatchObject({
      kind: 'text',
      patch: expect.stringContaining('-original'),
    });
    expect(JSON.stringify(diff)).not.toContain('descendant');
  }
});

it('ignores replacement objects when comparing HEAD with staged content', async () => {
  const { checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'original\n');
  git('add', '.');
  git('commit', '-m', 'original');
  const head = git('rev-parse', 'HEAD').toString().trim();
  await writeFile(join(checkout, 'file'), 'replacement\n');
  git('add', '.');
  git('commit', '-m', 'replacement');
  const replacement = git('rev-parse', 'HEAD').toString().trim();
  git('reset', '--hard', head);
  git('replace', head, replacement);
  await writeFile(join(checkout, 'file'), 'staged\n');
  git('add', '.');
  const diff = await reader.readDiff(
    selected(await reader.readStatus(), 'staged', 'file'),
  );
  expect(diff).toMatchObject({
    kind: 'text',
    patch: expect.stringContaining('-original'),
  });
  expect(JSON.stringify(diff)).not.toContain('-replacement');
});

it('rejects configured conversion drivers before status or working-tree diff can execute helpers', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'original\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await writeFile(join(checkout, 'file'), 'modified\n');
  const change = selected(await reader.readStatus(), 'unstaged', 'file');
  await writeFile(join(checkout, '.gitattributes'), 'file filter=probe\n');
  await expect(reader.readStatus()).rejects.toBeInstanceOf(
    UnsupportedGitFiltersError,
  );
  await expect(reader.readDiff(change)).rejects.toBeInstanceOf(
    UnsupportedGitFiltersError,
  );
  const marker = join(root, 'filter-executed');
  const helper = join(root, 'filter-helper');
  await writeFile(helper, `#!/bin/sh\ntouch '${marker}'\ncat\n`, {
    mode: 0o755,
  });
  const beforeIndex = await readFile(join(checkout, '.git/index'));
  const beforeRefs = git('show-ref');
  for (const driver of ['clean', 'process', 'smudge']) {
    git('config', `filter.probe.${driver}`, helper);
    await expect(reader.readStatus()).rejects.toBeInstanceOf(
      UnsupportedGitFiltersError,
    );
    await expect(reader.readDiff(change)).rejects.toBeInstanceOf(
      UnsupportedGitFiltersError,
    );
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(checkout, '.git/index'))).toEqual(beforeIndex);
    expect(git('show-ref')).toEqual(beforeRefs);
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('modified\n');
    git('config', '--unset', `filter.probe.${driver}`);
  }
});

it('does not lazily fetch promised blobs during status or selected diff inspection', async () => {
  const { root, checkout, git } = await fixture();
  await writeFile(join(checkout, 'file'), 'promised content\n');
  git('add', '.');
  git('commit', '-m', 'base');
  git('config', 'uploadpack.allowFilter', 'true');
  const partial = join(root, 'partial');
  git(
    'clone',
    '--filter=blob:none',
    '--no-checkout',
    `file://${checkout}`,
    partial,
  );
  const run = (...args: string[]) =>
    execFileSync('git', ['-C', partial, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const metadata = await stat(join(partial, '.git'), { bigint: true });
  const identity = `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
  const reader = new InspectionGit(partial, identity, identity);
  const missing = run('rev-list', '--objects', '--missing=print', 'HEAD');
  expect(missing.toString()).toContain('?');
  const marker = join(root, 'fetch-executed');
  run('config', 'remote.origin.uploadpack', `touch '${marker}'; false`);
  const status = await reader.readStatus();
  await expect(
    reader.readDiff(selected(status, 'staged', 'file')),
  ).rejects.toThrow();
  expect(run('rev-list', '--objects', '--missing=print', 'HEAD')).toEqual(
    missing,
  );
  await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('allows unused configured filters without invoking them', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await writeFile(join(checkout, 'file'), 'working\n');
  const marker = join(root, 'unused-filter-executed');
  git('config', 'filter.unused.clean', `touch '${marker}'; cat`);
  const status = await reader.readStatus();
  expect(
    await reader.readDiff(selected(status, 'unstaged', 'file')),
  ).toMatchObject({ kind: 'text', patch: expect.stringContaining('+working') });
  await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects literal driver names that also spell Git attribute-state markers', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  await writeFile(join(checkout, 'file'), 'working\n');
  const change = selected(await reader.readStatus(), 'unstaged', 'file');
  const marker = join(root, 'ambiguous-filter-executed');
  for (const driver of ['set', 'unset', 'unspecified']) {
    await writeFile(
      join(checkout, '.gitattributes'),
      `file filter=${driver}\n`,
    );
    git('config', `filter.${driver}.clean`, `touch '${marker}'; cat`);
    await expect(reader.readStatus()).rejects.toBeInstanceOf(
      UnsupportedGitFiltersError,
    );
    await expect(reader.readDiff(change)).rejects.toBeInstanceOf(
      UnsupportedGitFiltersError,
    );
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    git('config', '--unset', `filter.${driver}.clean`);
  }
});

it('does not inspect submodule working files or run their conversion drivers', async () => {
  const { root, checkout, git, reader } = await fixture();
  await writeFile(join(checkout, 'file'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'base');
  const source = join(root, 'source');
  git('clone', checkout, source);
  git('-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'module');
  git('commit', '-m', 'submodule');
  const module = join(checkout, 'module');
  const marker = join(root, 'submodule-filter-executed');
  execFileSync('git', [
    '-C',
    module,
    'config',
    'filter.probe.clean',
    `touch '${marker}'; cat`,
  ]);
  await writeFile(join(module, '.gitattributes'), 'file filter=probe\n');
  await writeFile(join(module, 'file'), 'working\n');
  const index = await readFile(join(checkout, '.git/index'));
  expect((await reader.readStatus()).changes).toEqual([]);
  await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(checkout, '.git/index'))).toEqual(index);
  expect(await readFile(join(module, 'file'), 'utf8')).toBe('working\n');
});
