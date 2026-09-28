import { describe, expect, it } from 'vitest';
import { commentsSeenThrough, retainIntent } from './comments.ts';

describe('retainIntent', () => {
  it('reuses the ids of a failed attempt when the same text is sent again', () => {
    const previous = { body: 'Please rename', messageId: 'first' };
    expect(
      retainIntent(previous, 'Please rename', () => ({
        body: 'Please rename',
        messageId: 'second',
      })),
    ).toEqual({ body: 'Please rename', messageId: 'first' });
  });

  it('starts a new comment when the text changed', () => {
    expect(
      retainIntent(
        { body: 'Please', messageId: 'first' },
        'Please rename',
        () => ({
          body: 'Please rename',
          messageId: 'second',
        }),
      ),
    ).toEqual({ body: 'Please rename', messageId: 'second' });
  });
});

describe('commentsSeenThrough', () => {
  it('waits until every list that holds comments was shown', () => {
    expect(
      commentsSeenThrough(
        { highest: 7, open: 2, resolved: 1 },
        new Set(['open']),
      ),
    ).toBe(null);
  });

  it('marks the latest revision seen once every non-empty list was shown', () => {
    expect(
      commentsSeenThrough(
        { highest: 7, open: 2, resolved: 0 },
        new Set(['open']),
      ),
    ).toBe(7);
  });

  it('marks nothing when there are no comments', () => {
    expect(
      commentsSeenThrough(
        { highest: 0, open: 0, resolved: 0 },
        new Set(['open', 'resolved']),
      ),
    ).toBe(null);
  });
});
