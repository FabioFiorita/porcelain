import { describe, expect, it } from 'vite-plus/test';
import { timelineChange } from './commit.ts';

describe('timelineChange', () => {
  it('names the older path of a change made before a rename', () => {
    expect(
      timelineChange(
        { status: 'added', path: 'README.md', previousPath: undefined },
        'docs/guide.md',
      ),
    ).toBe('Added as README.md');
  });
});
