import { expect, it } from 'vitest';
import { commentAnchorSchema } from './comments.ts';

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
