import { expect, it } from 'vitest';
import { listDetailMode } from './list-detail';

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
