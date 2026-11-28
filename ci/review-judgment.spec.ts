import { expect, it } from 'vite-plus/test';
import { judgeReview } from './review-judgment.ts';
import type { ReviewState } from './review-verdict.ts';

const clean = { findings: [], summary: 'All clear' };
const finding = {
  title: 'Data loss',
  body: 'Data lost',
  priority: 1 as const,
  path: 'file',
  line_start: 1,
  line_end: 1,
};
const blocked = { summary: 'Data loss', findings: [finding] };
const unavailable = () =>
  Promise.reject(new Error('No paid provider is available'));
function run() {
  return {
    head: 'head',
    lane: 'main' as const,
    requested: false,
    locallyReviewed: false,
    saved: undefined,
    decide: async () => false,
    review: unavailable,
  };
}

it('runs only the decision on the ordinary landing path', async () => {
  const input = run();
  expect(await judgeReview(input)).toEqual({
    reviewed: undefined,
    decision: { sha: 'head', needsOwner: false },
  });
});

it('runs both requested checks and reuses the result on an approval recheck of the same head', async () => {
  const input = {
    ...run(),
    requested: true,
    decide: async () => true,
    review: async () => clean,
  };
  const result = await judgeReview(input);
  expect(result).toEqual({
    reviewed: { sha: 'head', review: clean },
    decision: { sha: 'head', needsOwner: true },
  });
  const saved = {
    reviewed: { sha: 'head', review: clean },
    decision: { sha: 'head', needsOwner: true },
  };
  expect(await judgeReview({ ...run(), requested: true, saved })).toEqual(
    result,
  );
  expect(
    (await judgeReview({ ...input, head: 'next', saved })).decision?.sha,
  ).toBe('next');
});

it('keeps outstanding blocking findings until the new commit has received review', async () => {
  const input = run();
  const saved = {
    reviewed: {
      sha: 'previous',
      review: blocked,
    },
  };
  await expect(judgeReview({ ...input, saved })).rejects.toThrow(
    'verification',
  );
  await expect(
    judgeReview({ ...input, saved, locallyReviewed: true }),
  ).resolves.toMatchObject({ reviewed: undefined });
});

it('keeps an outstanding finding on the same head even after review is turned off', async () => {
  const input = run();
  const saved = {
    reviewed: { sha: 'head', review: blocked },
    decision: { sha: 'head', needsOwner: true },
  };
  expect(await judgeReview({ ...input, saved })).toEqual({
    reviewed: saved.reviewed,
    decision: saved.decision,
  });
});

it('requires the release reviewer even with a local review and never calls Decisions on promotion', async () => {
  expect(
    await judgeReview({
      ...run(),
      lane: 'release',
      locallyReviewed: true,
      decide: unavailable,
      review: async () => clean,
    }),
  ).toEqual({
    reviewed: { sha: 'head', review: clean, releaseRound: 1 },
    decision: undefined,
  });
});

it('stops requesting hosted reviews after round three, even when the head and base change', async () => {
  const input = { ...run(), lane: 'release' as const, decide: unavailable };
  const calls: number[] = [];
  let saved: ReviewState | undefined;
  for (const [round, releaseBase] of [
    [1, 'base'],
    [2, 'base'],
    [3, 'new-base'],
  ] as const) {
    const result = await judgeReview({
      ...input,
      head: `head-${round}`,
      releaseBase,
      saved,
      review: async (_, ordinal) => {
        calls.push(ordinal ?? -1);
        return blocked;
      },
    });
    saved = { releaseBase, releaseRound: round, reviewed: result.reviewed };
  }
  const fourthHead = await judgeReview({
    ...input,
    head: 'head-4',
    releaseBase: 'another-base',
    saved,
  });
  expect(calls).toEqual([1, 2, 3]);
  expect(fourthHead.reviewed).toEqual({
    sha: 'head-3',
    review: blocked,
    releaseRound: 3,
  });
});

it('does not request a fourth round if the third attempt failed to return a verdict', async () => {
  await expect(
    judgeReview({
      ...run(),
      lane: 'release',
      saved: {
        releaseBase: 'base',
        releaseRound: 3,
        reviewed: { sha: 'earlier', review: clean, releaseRound: 2 },
      },
    }),
  ).rejects.toThrow(
    'The final hosted release review did not return a verdict.',
  );
});
