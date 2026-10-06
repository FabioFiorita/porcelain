import { describe, expect, it } from 'vitest';
import { timelineChange } from './commit.ts';

describe('timelineChange', () => {
  it('names a rename by the path the file had before', () => {
    expect(
      timelineChange(
        { status: 'renamed', path: 'docs/guide.md', previousPath: 'README.md' },
        'docs/guide.md',
      ),
    ).toBe('Renamed from README.md');
  });

  it('names the change alone while the file had its current path', () => {
    expect(
      timelineChange(
        { status: 'modified', path: 'README.md', previousPath: undefined },
        'README.md',
      ),
    ).toBe('Modified');
  });

  it('names the older path of a change made before a rename', () => {
    expect(
      timelineChange(
        { status: 'added', path: 'README.md', previousPath: undefined },
        'docs/guide.md',
      ),
    ).toBe('Added as README.md');
  });
});
