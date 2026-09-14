import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { NodeFileWriter } from './file-writer.ts';

const roots: string[] = [];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-files-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it('saves text atomically, preserves executable mode, and refuses a stale editor or cancellation', async () => {
  const root = await fixture();
  const writer = new NodeFileWriter();
  await writeFile(join(root, 'a.sh'), 'old', { mode: 0o755 });
  expect(
    await writer.edit(root, {
      kind: 'write',
      path: 'a.sh',
      text: 'new',
      expectedFingerprint: hash('old'),
    }),
  ).toEqual({ path: 'a.sh', contentFingerprint: hash('new') });
  expect((await stat(join(root, 'a.sh'))).mode & 0o777).toBe(0o755);
  await expect(
    writer.edit(root, {
      kind: 'write',
      path: 'a.sh',
      text: 'stale',
      expectedFingerprint: hash('old'),
    }),
  ).rejects.toMatchObject({ code: 'CONTENT_CHANGED' });
  await expect(
    writer.edit(
      root,
      {
        kind: 'write',
        path: 'a.sh',
        text: 'cancelled',
        expectedFingerprint: hash('new'),
      },
      AbortSignal.abort(),
    ),
  ).rejects.toThrow();
  expect(await readFile(join(root, 'a.sh'), 'utf8')).toBe('new');
  expect(await readdir(root)).toEqual(['a.sh']);
});

it('creates and moves entries without replacing an existing destination', async () => {
  const root = await fixture();
  const writer = new NodeFileWriter();
  await writer.edit(root, {
    kind: 'create',
    path: 'folder',
    entryKind: 'directory',
  });
  await writer.edit(root, { kind: 'create', path: 'a', entryKind: 'file' });
  await writeFile(join(root, 'a'), 'keep');
  await expect(
    writer.edit(root, { kind: 'create', path: 'a', entryKind: 'file' }),
  ).rejects.toMatchObject({ code: 'ENTRY_EXISTS' });
  await writer.edit(root, { kind: 'move', path: 'a', destination: 'folder/b' });
  expect(await readFile(join(root, 'folder/b'), 'utf8')).toBe('keep');
  await writeFile(join(root, 'other'), 'other');
  await expect(
    writer.edit(root, { kind: 'move', path: 'other', destination: 'folder/b' }),
  ).rejects.toMatchObject({ code: 'ENTRY_EXISTS' });
  expect(await readFile(join(root, 'other'), 'utf8')).toBe('other');
  await writer.edit(root, {
    kind: 'move',
    path: 'folder',
    destination: 'renamed',
  });
  expect(await readFile(join(root, 'renamed/b'), 'utf8')).toBe('keep');
});

it('refuses symlink traversal and passes the literal symlink itself to trash', async () => {
  const root = await fixture();
  const outside = await fixture();
  const moveToTrash = vi.fn(async () => undefined);
  const writer = new NodeFileWriter(moveToTrash);
  await writeFile(join(outside, 'a'), 'outside');
  await symlink(outside, join(root, 'link'));
  for (const command of [
    {
      kind: 'write' as const,
      path: 'link/a',
      text: 'bad',
      expectedFingerprint: hash('outside'),
    },
    { kind: 'create' as const, path: 'link/b', entryKind: 'file' as const },
  ])
    await expect(writer.edit(root, command)).rejects.toMatchObject({
      code: 'PATH_NOT_READABLE',
    });
  await writer.edit(root, { kind: 'trash', path: 'link' });
  expect(moveToTrash).toHaveBeenCalledWith([join(root, 'link')]);
  expect(await readFile(join(outside, 'a'), 'utf8')).toBe('outside');
});
