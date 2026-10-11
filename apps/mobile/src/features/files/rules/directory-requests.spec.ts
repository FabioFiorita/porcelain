import { expect, test } from 'vitest';
import { directoryRequests } from './directory-requests';

test('renamed and removed ancestors stop directory reads, including stale descendants', () => {
  expect(
    directoryRequests(
      ['', 'src', 'src/nested', 'docs', 'docs/archive'],
      [
        {
          worktreeId: 'w',
          path: '',
          entries: [
            { name: 'source', kind: 'directory' },
            { name: 'docs', kind: 'file' },
          ],
        },
        {
          worktreeId: 'w',
          path: 'src',
          entries: [{ name: 'nested', kind: 'directory' }],
        },
      ],
    ),
  ).toEqual(['']);
});

test('unread parents preserve pending reads and current directories remain requested', () => {
  const requested = ['', 'src', 'src/nested', 'src/nested/deep'];
  expect(directoryRequests(requested, [])).toEqual(requested);
  expect(
    directoryRequests(requested, [
      {
        worktreeId: 'w',
        path: '',
        entries: [{ name: 'src', kind: 'directory' }],
      },
      {
        worktreeId: 'w',
        path: 'src',
        entries: [{ name: 'nested', kind: 'directory' }],
      },
    ]),
  ).toEqual(requested);
});
