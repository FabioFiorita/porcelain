import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openApplication } from './app.ts';
import type { CommentCommand } from './models/comment-thread.ts';
import { InvalidCommentError } from './use-cases/errors/invalid-comment-error.ts';

it('rejects invalid application input without persistence and captures command intent before queueing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comment-application-'));
  const path = join(root, 'repo');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const app = await openApplication({ dataDirectory: join(root, 'state') });
  try {
    const { project } = await app.register(path);
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const create = {
      kind: 'create' as const,
      worktreeId,
      anchor: {
        kind: 'codeRange' as const,
        filePath: 'a.ts',
        startLine: 1,
        endLine: 2,
      },
      body: 'original',
    };
    const pending = app.comments(create);
    create.anchor.startLine = 100;
    create.body = 'mutated';
    const [created] = await pending;
    if (!created) throw new Error('Missing thread');
    expect(created).toMatchObject({
      anchor: { startLine: 1 },
      messages: [{ body: 'original' }],
    });
    const before = await app.comments({ kind: 'list', worktreeId });
    const invalid: CommentCommand[] = [
      ...['', ' ', 'x'.repeat(16001), 'a\0'].map((body) => ({
        ...create,
        anchor: { ...create.anchor, startLine: 1 },
        body,
      })),
      ...[0, 3, 1.5, Number.NaN].map((startLine) => ({
        ...create,
        anchor: { ...create.anchor, startLine },
      })),
      ...['../a', '.git/config', 'C:a', 'a\\b', 'x'.repeat(4097)].map(
        (filePath) => ({
          ...create,
          anchor: { kind: 'file' as const, filePath },
        }),
      ),
      { ...create, anchor: { kind: 'file', filePath: 'a', revision: '' } },
      { kind: 'reply', worktreeId, threadId: created.id, body: ' ' },
    ];
    for (const command of invalid)
      await expect(app.comments(command)).rejects.toBeInstanceOf(
        InvalidCommentError,
      );
    expect(await app.comments({ kind: 'list', worktreeId })).toEqual(before);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
