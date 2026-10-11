import { Effect } from 'effect';
import { mkdtempSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { identity, formatIdentity } from './identity.ts';

describe('filesystem identity', () => {
  it('preserves the exact inode and nanosecond birth time across a move', async ({
    onTestFinished,
  }) => {
    const root = mkdtempSync(join(tmpdir(), 'porcelain-identity-'));
    const moved = `${root}-moved`;
    onTestFinished(() => rmSync(moved, { recursive: true, force: true }));
    const info = statSync(root, { bigint: true });
    const expected = `${info.ino}:${info.birthtimeNs}`;
    expect(await Effect.runPromise(identity(root))).toBe(expected);
    renameSync(root, moved);
    expect(await Effect.runPromise(identity(moved))).toBe(expected);
    const failure = await Effect.runPromise(Effect.flip(identity(root)));
    expect(failure).toMatchObject({
      _tag: 'GitFilesystemError',
      cause: { code: 'ENOENT' },
    });
  });
});

it('keeps the same identity when the mount device changes', () => {
  const original = {
    dev: 16777230n,
    ino: 295184405n,
    birthtimeNs: 1781272623876395589n,
  };
  expect(formatIdentity(original)).toBe('295184405:1781272623876395589');
  const afterReboot = { ...original, dev: 16777233n };
  expect(formatIdentity(afterReboot)).toBe('295184405:1781272623876395589');
});
