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
