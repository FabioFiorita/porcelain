import { describe, expect, it } from 'vitest';
import { diffPresentation } from './diff-presentation';

describe('review diff presentation', () => {
  it('keeps binary comparisons distinct from an empty text diff', () => {
    expect(diffPresentation({ kind: 'binary' })).toEqual({
      kind: 'notice',
      title: 'Binary change',
      description: 'This comparison cannot be displayed as text.',
    });
  });
  it('retains mode and rename metadata without selectable code lines', () => {
    expect(
      diffPresentation({
        kind: 'metadata-only',
        patch: 'old mode 100644\nnew mode 100755\n',
      }),
    ).toEqual({
      kind: 'metadata',
      source: 'old mode 100644\nnew mode 100755\n',
    });
  });
  it('reports malformed content rather than presenting a clean or empty comparison', () => {
    expect(
      diffPresentation({
        kind: 'text',
        patch: '@@ -1,2 +1,2 @@\n-old\n+new\n',
      }),
    ).toEqual({
      kind: 'notice',
      title: 'Diff unavailable',
      description: 'The server returned a patch that could not be displayed.',
    });
  });
  it('explains a text comparison without changed lines', () => {
    expect(diffPresentation({ kind: 'text', patch: '' })).toEqual({
      kind: 'notice',
      title: 'No text changes',
      description: 'This comparison contains no changed text lines.',
    });
  });
  it('supplies literal old and new line addresses for native review selection', () => {
    expect(
      diffPresentation({ kind: 'text', patch: '@@ -8 +10 @@\n-old\n+new\n' }),
    ).toEqual({
      kind: 'text',
      lines: [
        { id: 'patch:0', text: '@@ -8 +10 @@' },
        { id: 'patch:1', text: 'old', kind: 'removed', oldLine: 8 },
        { id: 'patch:2', text: 'new', kind: 'added', newLine: 10 },
      ],
    });
  });
});
