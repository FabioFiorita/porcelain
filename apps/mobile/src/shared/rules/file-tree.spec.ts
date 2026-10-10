import { expect, test } from 'vitest';
import {
  directoryRequests,
  isNativeImagePath,
  sourceLanguage,
} from './file-tree';

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

test('SVG files use editable source while bitmap images keep native previews', () => {
  expect(isNativeImagePath('assets/logo.SVG')).toBe(false);
  expect(sourceLanguage('assets/logo.SVG')).toBe('xml');
  expect(isNativeImagePath('assets/photo.PNG')).toBe(true);
  expect(isNativeImagePath('assets/photo.jpg')).toBe(true);
  expect(isNativeImagePath('src/main.ts')).toBe(false);
});
