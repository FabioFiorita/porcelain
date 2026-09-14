import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../../domain/history';
import { historyGraphWidth } from './history-graph';

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

describe('historyGraphWidth', () => {
  it('reserves an outgoing lane when the loaded page ends before a merge parent', () => {
    const rows = layoutGraph([
      commit('merge', [oid('first'), oid('second')]),
      commit('first'),
    ]);

    expect(rows[0]?.outgoing).toEqual([0, 1]);
    expect(historyGraphWidth(rows)).toBe(42);
  });
});
