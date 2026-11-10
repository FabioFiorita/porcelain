import { expect, it } from 'vitest';
import { listDetailMode, listDetailModeChange } from './list-detail';

it.each([
  {
    tablet: false,
    width: 932,
    mode: 'stack',
    why: 'a phone in landscape keeps pushing',
  },
  {
    tablet: false,
    width: undefined,
    mode: 'stack',
    why: 'a phone before layout',
  },
  {
    tablet: true,
    width: undefined,
    mode: 'beside',
    why: 'a tablet before layout, so nothing flashes',
  },
  { tablet: true, width: 744, mode: 'beside', why: 'iPad mini in portrait' },
  {
    tablet: true,
    width: 860,
    mode: 'beside',
    why: 'iPad landscape beside the open sidebar',
  },
  { tablet: true, width: 700, mode: 'beside', why: 'exactly the minimum' },
  { tablet: true, width: 699, mode: 'stack', why: 'just below the minimum' },
  {
    tablet: true,
    width: 320,
    mode: 'stack',
    why: 'a narrow multitasking window',
  },
] as const)('$why: $mode', ({ tablet, width, mode }) => {
  expect(listDetailMode({ tablet, width })).toBe(mode);
});

it.each([
  {
    tablet: true,
    from: undefined,
    to: 600,
    change: undefined,
    why: 'the first measurement of a narrow tablet is not a rotation',
  },
  {
    tablet: true,
    from: 1280,
    to: 640,
    change: 'stack',
    why: 'a tablet turning narrower than the minimum',
  },
  {
    tablet: true,
    from: 640,
    to: 1024,
    change: 'beside',
    why: 'a tablet turning wide enough',
  },
  {
    tablet: true,
    from: 1280,
    to: 800,
    change: undefined,
    why: 'a tablet that stays wide enough',
  },
  {
    tablet: false,
    from: 400,
    to: 900,
    change: undefined,
    why: 'a phone turning to landscape keeps pushing',
  },
] as const)('$why: $change', ({ tablet, from, to, change }) => {
  expect(listDetailModeChange({ tablet, from, to })).toBe(change);
});
