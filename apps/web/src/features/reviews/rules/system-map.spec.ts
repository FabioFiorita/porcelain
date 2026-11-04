import { expect, it } from 'vitest';
import {
  layoutMap,
  MAP_BOX_HEIGHT,
  MAP_BOX_WIDTH,
  diagramSlice,
  edgeLabels,
} from './system-map';

it('places dependencies below their callers and keeps the annotation data', () => {
  const result = layoutMap({
    boxes: [
      { id: 'a', label: 'Caller', problem: 'Choose an owner' },
      { id: 'b', label: 'Owner' },
    ],
    arrows: [{ from: 'a', to: 'b' }],
  });
  expect(result).toEqual({
    width: MAP_BOX_WIDTH,
    height: MAP_BOX_HEIGHT * 2 + 48,
    boxes: [
      { id: 'a', label: 'Caller', problem: 'Choose an owner', x: 0, y: 0 },
      { id: 'b', label: 'Owner', x: 0, y: MAP_BOX_HEIGHT + 48 },
    ],
  });
});
it('wraps disconnected owners after three boxes and never overlaps', () => {
  const boxes = Array.from({ length: 7 }, (_, index) => ({
    id: `${index}`,
    label: `Owner ${index}`,
  }));
  const result = layoutMap({ boxes, arrows: [] });
  expect(result.width).toBe(3 * MAP_BOX_WIDTH + 56);
  expect(result.height).toBe(3 * MAP_BOX_HEIGHT + 96);
  expect(new Set(result.boxes.map((box) => `${box.x}:${box.y}`)).size).toBe(7);
  expect(result.boxes.at(-1)).toMatchObject({
    id: '6',
    x: MAP_BOX_WIDTH + 28,
    y: 2 * (MAP_BOX_HEIGHT + 48),
  });
});
it('keeps cycles and self imports bounded and includes every box', () => {
  const result = layoutMap({
    boxes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    arrows: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'a', to: 'a' },
    ],
  });
  expect(result.boxes.map((box) => box.id).sort()).toEqual(['a', 'b']);
  expect(result.height).toBeLessThanOrEqual(2 * MAP_BOX_HEIGHT + 48);
});
it('gives an empty diagram zero height', () => {
  expect(layoutMap({ boxes: [], arrows: [] })).toEqual({
    width: MAP_BOX_WIDTH,
    height: 0,
    boxes: [],
  });
});

it('shows the agent drawing and its direct neighbours without inventing parts', () => {
  const diagram = {
    boxes: [
      { id: 'a', label: 'A', layerId: 'decision' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    arrows: [
      { from: 'a', to: 'b', label: 'saves' },
      { from: 'b', to: 'c', label: 'reads' },
    ],
  };
  expect(diagramSlice(diagram)).toEqual(diagram);
  expect(diagramSlice(diagram, 'decision')).toEqual({
    boxes: diagram.boxes.slice(0, 2),
    arrows: diagram.arrows.slice(0, 1),
  });
});
it('keeps repeated neighbouring labels and labels inside nodes in hover titles only', () => {
  const diagram = {
    boxes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    arrows: [
      { from: 'a', to: 'b', label: 'saves' },
      { from: 'a', to: 'c', label: 'saves' },
    ],
  };
  expect(edgeLabels(diagram, layoutMap(diagram))).toEqual([true, false]);
  const sameRow = {
    ...diagram,
    arrows: [{ from: 'b', to: 'c', label: 'A label' }],
  };
  expect(
    edgeLabels(sameRow, {
      width: 700,
      height: 100,
      boxes: sameRow.boxes.map((box, index) => ({
        ...box,
        x: index * 228,
        y: 0,
      })),
    }),
  ).toEqual([false]);
});
