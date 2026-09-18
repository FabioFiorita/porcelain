import { describe, expect, it } from 'vitest';
import {
  type GuideSource,
  guidePositionKey,
  guideSourceStatus,
  type ReviewGuide,
  selectedGuideStep,
} from './guided-review';
import type { TextFile } from './review';

const source: GuideSource = {
  path: 'src/flow.ts',
  startLine: 2,
  endLine: 3,
  contentFingerprint: 'a'.repeat(64),
};
const file: TextFile = {
  worktreeId: 'worktree',
  path: source.path,
  encoding: 'utf-8',
  text: 'one\ntwo\nthree\n',
  byteLength: 14,
  contentFingerprint: source.contentFingerprint,
};
const guide: ReviewGuide = {
  purpose: 'Follow the state owner.',
  steps: [
    { id: 'first', title: 'Enter', question: 'Who enters?', source },
    { id: 'second', title: 'Leave', question: 'Who leaves?', source },
  ],
};

describe('guide source identity', () => {
  it.each(['one\ntwo\nthree', 'one\ntwo\nthree\n', 'one\r\ntwo\r\nthree\r\n'])(
    'accepts an inclusive range in matching full source',
    (text) => {
      expect(guideSourceStatus(source, { ...file, text })).toBe('current');
    },
  );

  it('does not treat a trailing newline as another source line', () => {
    expect(guideSourceStatus({ ...source, endLine: 4 }, file)).toBe(
      'invalid-range',
    );
    expect(guideSourceStatus(source, { ...file, text: '' })).toBe(
      'invalid-range',
    );
  });

  it.each([
    { startLine: 0 },
    { startLine: 1.5 },
    { startLine: 3, endLine: 2 },
    { endLine: Number.POSITIVE_INFINITY },
  ])('rejects invalid ranges even outside the wire boundary', (range) => {
    expect(guideSourceStatus({ ...source, ...range }, file)).toBe(
      'invalid-range',
    );
  });

  it('separates stale, unbound and mismatched source', () => {
    expect(
      guideSourceStatus(source, {
        ...file,
        contentFingerprint: 'b'.repeat(64),
      }),
    ).toBe('stale');
    const unbound = { ...file };
    delete unbound.contentFingerprint;
    expect(guideSourceStatus(source, unbound)).toBe('unverified');
    expect(guideSourceStatus(source, { ...file, path: 'different.ts' })).toBe(
      'unavailable',
    );
  });
});

describe('guide reading position', () => {
  it('uses stable IDs across reorder and falls back after removal', () => {
    const reversed = { ...guide, steps: [...guide.steps].reverse() };
    expect(selectedGuideStep(reversed, 'second')?.title).toBe('Leave');
    expect(selectedGuideStep(guide, 'removed')?.id).toBe('first');
    expect(selectedGuideStep(guide, null)?.id).toBe('first');
    expect(
      selectedGuideStep({ ...guide, steps: [] }, 'second'),
    ).toBeUndefined();
  });

  it('isolates environments, projects, worktrees and layers', () => {
    const scope = { projectId: 'project', worktreeId: 'worktree' };
    const keys = [
      guidePositionKey('env', scope, 'layer'),
      guidePositionKey('other-env', scope, 'layer'),
      guidePositionKey('env', { ...scope, projectId: 'other' }, 'layer'),
      guidePositionKey('env', { ...scope, worktreeId: 'other' }, 'layer'),
      guidePositionKey('env', scope, 'other-layer'),
    ];
    expect(new Set(keys).size).toBe(5);
  });
});
