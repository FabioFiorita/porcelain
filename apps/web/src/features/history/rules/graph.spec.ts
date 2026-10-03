import { describe, expect, it } from 'vitest';
import {
  historyFollows,
  historyGraphWidth,
  historyRefLabel,
  layoutGraph,
  ordinal,
  shortOid,
} from './graph.ts';

type Commit = Parameters<typeof layoutGraph>[0][number];

function commit(oid: string, parentOids: string[]): Commit {
  return {
    oid,
    parentOids,
    author: { name: 'Author', timestamp: '2026-01-01T00:00:00Z' },
    subject: oid,
    subjectTruncated: false,
    body: undefined,
    bodyTruncated: false,
    refs: [],
  };
}

describe('history graph layout', () => {
  it('keeps a straight ancestry in one lane and leaves an empty history empty', () => {
    expect(layoutGraph([])).toEqual([]);
    const rows = layoutGraph([commit('new', ['root']), commit('root', [])]);
    expect(
      rows.map(({ lane, outgoing, lanesAfter }) => ({
        lane,
        outgoing,
        lanesAfter,
      })),
    ).toEqual([
      { lane: 0, outgoing: [0], lanesAfter: ['root'] },
      { lane: 0, outgoing: [], lanesAfter: [null] },
    ]);
  });

  it('gives a merge parent a second lane and rejoins waiting parents', () => {
    const rows = layoutGraph([
      commit('merge', ['left', 'right']),
      commit('left', ['root']),
      commit('right', ['root']),
      commit('root', []),
    ]);
    expect(rows.map(({ lane, outgoing }) => ({ lane, outgoing }))).toEqual([
      { lane: 0, outgoing: [0, 1] },
      { lane: 0, outgoing: [0] },
      { lane: 1, outgoing: [1] },
      { lane: 0, outgoing: [] },
    ]);
    expect(historyGraphWidth(rows)).toBeGreaterThan(
      historyGraphWidth(layoutGraph([commit('root', [])])),
    );
  });
});

describe('history labels', () => {
  it('names the current branch, detached head, and unborn branch', () => {
    const label = (ref: string) => ref.replace('refs/heads/', '');
    expect(historyFollows(undefined, label)).toBe('This branch');
    expect(
      historyFollows(
        {
          tipOid: undefined,
          head: { kind: 'attached', ref: 'refs/heads/topic' },
        },
        label,
      ),
    ).toBe('topic');
    expect(
      historyFollows({ tipOid: undefined, head: { kind: 'detached' } }, label),
    ).toBe('Detached HEAD');
    expect(
      historyFollows(
        { tipOid: undefined, head: { kind: 'unborn', ref: 'refs/heads/new' } },
        label,
      ),
    ).toBe('No commits yet on new');
  });

  it('shortens refs and object IDs and uses the right ordinal suffix', () => {
    expect(historyRefLabel('refs/remotes/origin/topic')).toBe('origin/topic');
    expect(shortOid('0123456789')).toBe('0123456');
    expect([1, 2, 3, 11, 21, 22, 23].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '11th',
      '21st',
      '22nd',
      '23rd',
    ]);
  });
});
