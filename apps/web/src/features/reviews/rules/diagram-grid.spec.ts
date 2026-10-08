import { describe, expect, it } from 'vitest';
import { diagramGrid } from './diagram-grid';

const boxes = Array.from({ length: 8 }, (_, index) => ({
  id: `behavior-${index}`,
  lane: 0,
  height: index === 0 ? 150 : 64,
}));

describe('diagramGrid', () => {
  it('wraps a large lane into readable rows while keeping every component', () => {
    const grid = diagramGrid(['Behaviors'], boxes, 600);
    expect(grid.width).toBe(540);
    expect([...grid.positions.keys()]).toEqual(boxes.map((box) => box.id));
    expect(grid.positions.get('behavior-0')).toEqual({ x: 16, y: 36 });
    expect(grid.positions.get('behavior-1')).toEqual({ x: 284, y: 36 });
    expect(grid.positions.get('behavior-2')).toEqual({ x: 16, y: 226 });
    expect(grid.height).toBeGreaterThan(500);
  });

  it('uses one column on a phone and puts the next lane below all wrapped rows', () => {
    const grid = diagramGrid(
      ['Behaviors', 'Owners'],
      [...boxes, { id: 'owner', lane: 1, height: 80 }],
      300,
    );
    expect(grid.width).toBe(272);
    expect(
      [...grid.positions.values()].every((position) => position.x === 16),
    ).toBe(true);
    expect(grid.positions.get('owner')!.y).toBeGreaterThan(
      grid.positions.get('behavior-7')!.y + 64,
    );
  });

  it('limits wide canvases to three columns without shrinking the cards', () => {
    const grid = diagramGrid(['Behaviors'], boxes, 1861);
    expect(grid.width).toBe(808);
    expect(grid.positions.get('behavior-3')!.x).toBe(16);
    expect(grid.positions.get('behavior-3')!.y).toBeGreaterThan(186);
  });
});

it('lays out a selected owner beside a vertical list of callers with a clear connection gutter', () => {
  const grid = diagramGrid(['Owners'], boxes, 800, 'behavior-0');
  expect(grid.positions.get('behavior-0')).toEqual({ x: 16, y: 36 });
  expect(grid.positions.get('behavior-1')).toEqual({ x: 300, y: 36 });
  expect(grid.positions.get('behavior-2')).toEqual({ x: 300, y: 148 });
  expect(grid.width).toBe(556);
  expect(grid.positions.size).toBe(8);
});

it('keeps a narrow ownership trace in one column with room for connections on its left', () => {
  const grid = diagramGrid(['Owners'], boxes, 400, 'behavior-0');
  expect(grid.positions.get('behavior-0')).toEqual({ x: 40, y: 36 });
  expect(grid.positions.get('behavior-1')).toEqual({ x: 40, y: 234 });
  expect(grid.width).toBe(296);
  expect(grid.positions.size).toBe(8);
});
