import { expect, it } from 'vitest';
import { walkthroughStops } from '@porcelain/client/reviews/rules';
import { briefingContinuation, stopScreenTitle } from './briefing';

const stops = walkthroughStops(
  {
    layers: ['first', 'second', 'third'].map((id) => ({
      id,
      title: id,
      summary: id,
      fingerprint: id,
      lanes: ['Client'],
      steps: [],
    })),
    notExplained: [],
  },
  ['unexplained.ts', 'test.spec.ts'],
  { specsApart: true },
);

it.each([
  { reviewed: [], number: 1, key: 'decision:first' },
  { reviewed: ['decision:first'], number: 2, key: 'decision:second' },
  {
    reviewed: ['decision:first', 'decision:third'],
    number: 2,
    key: 'decision:second',
  },
  {
    reviewed: ['decision:first', 'decision:second', 'decision:third'],
    number: 1,
    key: 'decision:first',
  },
])('continues the walkthrough for $reviewed', ({ reviewed, number, key }) => {
  expect(
    briefingContinuation(stops, (stop) => reviewed.includes(stop.key)),
  ).toEqual({
    key,
    label: `Continue at decision ${number}`,
  });
});

it('offers no decision action for a review with only closing stops', () => {
  expect(
    briefingContinuation(
      stops.filter((stop) => stop.kind !== 'decision'),
      () => false,
    ),
  ).toBeUndefined();
});

it('titles a decision screen by its place among decisions and other stops by name', () => {
  const titles = stops.flatMap((stop) =>
    stop.kind === 'briefing' ? [] : [stopScreenTitle(stop, stops)],
  );
  expect(titles).toEqual([
    'Decision 1 of 3',
    'Decision 2 of 3',
    'Decision 3 of 3',
    'Not explained',
    'Specs',
  ]);
});
