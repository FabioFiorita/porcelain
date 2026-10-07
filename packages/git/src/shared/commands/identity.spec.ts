import { Effect } from 'effect';
import { mkdtempSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { identity } from './identity.ts';

describe('filesystem identity', () => {
  it('preserves the exact device, inode and nanosecond birth time across a move', async ({
    onTestFinished,
  }) => {
    const root = mkdtempSync(join(tmpdir(), 'porcelain-identity-'));
    const moved = `${root}-moved`;
    onTestFinished(() => rmSync(moved, { recursive: true, force: true }));
    const info = statSync(root, { bigint: true });
    const expected = `${info.dev}:${info.ino}:${info.birthtimeNs}`;
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
