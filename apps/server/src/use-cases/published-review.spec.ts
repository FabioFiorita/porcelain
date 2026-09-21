import { expect, it } from 'vitest';
import { mapOldLine } from './published-review.ts';

it('maps staged changed lines through a pure unstaged insertion', () => {
  const unstaged = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -0,0 +1,3 @@',
    '+one',
    '+two',
    '+three',
    '',
  ].join('\n');
  expect(mapOldLine(unstaged, 10)).toBe(13);
});
