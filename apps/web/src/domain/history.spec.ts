import { describe, expect, it } from 'vitest';
import {
  historyFollows,
  historyRefLabel,
  layoutGraph,
  ordinal,
  shortOid,
} from './history';

const oid = (value: string) => value.repeat(40);
const commit = (value: string, parentOids: string[] = []) => ({
  oid: oid(value),
  parentOids,
  author: { name: 'Author', timestamp: '2026-09-13T00:00:00.000Z' },
  subject: value,
  subjectTruncated: false,
  body: null,
  bodyTruncated: false,
  refs: [],
});

describe('history domain', () => {
  it('keeps a first-parent lane and fans merge parents into graph rails', () => {
    const root = oid('d');
    const firstParent = oid('a');
    const secondParent = oid('b');
    const rows = layoutGraph([
      commit('c', [firstParent, secondParent]),
      commit('a', [root]),
      commit('b', [root]),
      commit('d'),
    ]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 1, 0]);
    expect(rows[0]?.outgoing).toEqual([0, 1]);
    expect(rows[0]?.lanesAfter).toEqual([firstParent, secondParent]);
    expect(rows[2]?.outgoing).toEqual([1]);
  });

  it('describes attached, detached and unborn heads compactly', () => {
    expect(
      historyFollows({ kind: 'attached', ref: 'refs/heads/feature/review' }),
    ).toBe('feature/review');
    expect(historyFollows({ kind: 'detached' })).toBe('Detached HEAD');
    expect(
      historyFollows({ kind: 'unborn', ref: 'refs/heads/new-branch' }),
    ).toBe('No commits yet on new-branch');
  });

  it('shortens commit IDs for compact rows', () => {
    expect(shortOid(oid('a'))).toBe('aaaaaaa');
  });

  it('formats full branch, remote and tag refs for compact labels', () => {
    expect([
      historyRefLabel('refs/heads/feature/review'),
      historyRefLabel('refs/remotes/origin/feature/review'),
      historyRefLabel('refs/tags/v1.2.3'),
    ]).toEqual(['feature/review', 'origin/feature/review', 'v1.2.3']);
  });

  it('formats merge parent numbers without teen suffix mistakes', () => {
    expect([
      ordinal(1),
      ordinal(2),
      ordinal(3),
      ordinal(11),
      ordinal(12),
    ]).toEqual(['1st', '2nd', '3rd', '11th', '12th']);
  });
});
