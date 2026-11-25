import { expect, it } from 'vite-plus/test';
import { comparisonWrites, type ComparisonRead } from './comparison-writes';

const current = { shown: true, current: true };
const retained = { shown: true, current: false };
const nothing = { shown: false, current: false };
const open = { discard: true, review: true };
const closed = { discard: false, review: false };

it.each<{ kind: string; state: string; read: ComparisonRead; writes: object }>([
  { kind: 'staged', state: 'current', read: current, writes: open },
  { kind: 'staged', state: 'retained', read: retained, writes: closed },
  { kind: 'staged', state: 'missing or loading', read: nothing, writes: open },
  { kind: 'staged', state: 'failed', read: nothing, writes: open },
  { kind: 'unstaged', state: 'current', read: current, writes: open },
  { kind: 'unstaged', state: 'retained', read: retained, writes: closed },
  {
    kind: 'unstaged',
    state: 'missing or loading',
    read: nothing,
    writes: open,
  },
  { kind: 'unstaged', state: 'failed', read: nothing, writes: open },
  { kind: 'untracked text', state: 'current', read: current, writes: open },
  { kind: 'untracked text', state: 'retained', read: retained, writes: closed },
  {
    kind: 'untracked text',
    state: 'missing or loading',
    read: nothing,
    writes: open,
  },
  { kind: 'untracked text', state: 'failed', read: nothing, writes: open },
  {
    kind: 'untracked binary',
    state: 'read without text',
    read: nothing,
    writes: open,
  },
  { kind: 'untracked symlink', state: 'refused', read: nothing, writes: open },
  { kind: 'unsupported', state: 'never shown', read: nothing, writes: open },
  { kind: 'conflict', state: 'never shown', read: nothing, writes: open },
])('a $kind comparison that is $state allows $writes', ({ read, writes }) => {
  expect(comparisonWrites([read], read)).toEqual(writes);
});

it('a retained staged deletion beside current untracked text withholds the file review from both, and discard only from itself', () => {
  const file = [retained, current];
  expect(comparisonWrites(file, current)).toEqual({
    discard: true,
    review: false,
  });
  expect(comparisonWrites(file, retained)).toEqual(closed);
});
