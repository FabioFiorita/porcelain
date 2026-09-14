import { expect, it } from 'vitest';
import {
  commentAnchorSchema,
  commentThreadSchema,
  createCommentThreadSchema,
} from './comments.ts';

it('accepts literal colon names and the maximum path length for both anchor kinds', () => {
  for (const filePath of [
    'notes:today.txt',
    'nested/notes:today.txt',
    'x'.repeat(4096),
  ]) {
    for (const anchor of [
      { kind: 'file', filePath },
      { kind: 'codeRange', filePath, startLine: 1, endLine: 2 },
    ]) {
      expect(commentAnchorSchema.parse(anchor)).toEqual(anchor);
    }
  }
  expect(
    commentAnchorSchema.safeParse({ kind: 'file', filePath: 'x'.repeat(4097) })
      .success,
  ).toBe(false);
});

it('requires message authors, keeps legacy timestamps optional, and accepts diff sides', () => {
  expect(
    commentAnchorSchema.parse({
      kind: 'codeRange',
      filePath: 'src/a.ts',
      startLine: 3,
      endLine: 5,
      side: 'deletions',
    }),
  ).toMatchObject({ side: 'deletions' });
  expect(
    commentThreadSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      worktreeId: '00000000-0000-4000-8000-000000000002',
      anchor: { kind: 'file', filePath: 'README.md' },
      resolved: false,
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          body: 'legacy message',
          author: 'reviewer',
        },
      ],
    }),
  ).toMatchObject({ messages: [{ author: 'reviewer' }] });
  expect(
    commentThreadSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      worktreeId: '00000000-0000-4000-8000-000000000002',
      anchor: { kind: 'file', filePath: 'README.md' },
      resolved: false,
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          body: 'missing author',
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    createCommentThreadSchema.safeParse({
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'client input',
      author: 'agent',
      createdAt: '2026-09-14T00:00:00.000Z',
    }).success,
  ).toBe(false);
});

it('keeps comparison identity and requires immutable revisions for commit comments', () => {
  const anchor = {
    kind: 'codeRange',
    filePath: 'a.ts',
    startLine: 2,
    endLine: 4,
    side: 'deletions',
  };
  const commit = {
    ...anchor,
    comparison: { kind: 'commit', parent: 2 },
    revision: 'a'.repeat(40),
  };
  expect(commentAnchorSchema.parse(commit)).toEqual(commit);
  for (const revision of [undefined, 'HEAD', 'main', 'a'.repeat(7)])
    expect(commentAnchorSchema.safeParse({ ...commit, revision }).success).toBe(
      false,
    );
  for (const parent of [0, -1, 1.5, 1001])
    expect(
      commentAnchorSchema.safeParse({
        ...commit,
        comparison: { kind: 'commit', parent },
      }).success,
    ).toBe(false);
  expect(
    commentAnchorSchema.safeParse({
      ...commit,
      comparison: { kind: 'worktree', scope: 'staged' },
    }).success,
  ).toBe(false);
  for (const scope of ['staged', 'unstaged', 'untracked'])
    expect(
      commentAnchorSchema.safeParse({
        ...anchor,
        comparison: { kind: 'worktree', scope },
      }).success,
    ).toBe(true);
});
