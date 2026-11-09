import { describe, expect, it } from 'vitest';
import { stackMargin } from './margin-stack';

describe('stackMargin', () => {
  it.each([
    {
      name: 'leaves a lone thread beside its line',
      boxes: [{ top: 80, height: 113 }],
      offsets: [0],
    },
    {
      name: 'leaves threads that already clear each other in place',
      boxes: [
        { top: 0, height: 100 },
        { top: 200, height: 100 },
      ],
      offsets: [0, 0],
    },
    {
      name: 'moves the second of two adjacent-line threads below the first',
      boxes: [
        { top: 100, height: 113 },
        { top: 120, height: 113 },
      ],
      offsets: [0, 105],
    },
    {
      name: 'stacks five threads on consecutive lines in line order',
      boxes: [
        { top: 0, height: 113 },
        { top: 20, height: 113 },
        { top: 40, height: 60 },
        { top: 60, height: 113 },
        { top: 80, height: 113 },
      ],
      offsets: [0, 105, 210, 262, 367],
    },
    {
      name: 'keeps a pushed thread from overlapping a later one further down',
      boxes: [
        { top: 0, height: 300 },
        { top: 20, height: 100 },
        { top: 400, height: 50 },
        { top: 420, height: 50 },
      ],
      offsets: [0, 292, 24, 66],
    },
    {
      name: 'orders by position when cards arrive out of line order',
      boxes: [
        { top: 40, height: 50 },
        { top: 0, height: 50 },
      ],
      offsets: [22, 0],
    },
  ])('$name', ({ boxes, offsets }) => {
    expect(stackMargin(boxes)).toEqual(offsets);
  });
});
