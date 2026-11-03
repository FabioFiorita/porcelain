import type { ReviewRevision } from '@porcelain/client/reviews/rules';

type Content = ReviewRevision['content'];
type Diagram = NonNullable<Content['diagram']>['after'];
export type MapBox = Diagram['boxes'][number];
export type MapArrow = Diagram['arrows'][number];

export const MAP_BOX_WIDTH = 200;
export const MAP_BOX_HEIGHT = 88;
const COLUMN_GAP = 28;
const ROW_GAP = 48;
const MAX_ROW = 3;

export type PlacedBox = MapBox & { x: number; y: number };
export type MapLayout = {
  width: number;
  height: number;
  boxes: PlacedBox[];
};

function ranks(diagram: Diagram): Map<string, number> {
  const rank = new Map(diagram.boxes.map((box) => [box.id, 0]));
  for (let pass = 0; pass < diagram.boxes.length; pass++) {
    let moved = false;
    for (const arrow of diagram.arrows) {
      const from = rank.get(arrow.from);
      const to = rank.get(arrow.to);
      if (from === undefined || to === undefined) continue;
      if (to < from + 1) {
        rank.set(arrow.to, from + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const incoming = new Set(diagram.arrows.map((arrow) => arrow.to));
  for (const box of diagram.boxes) {
    if (incoming.has(box.id)) continue;
    const children = diagram.arrows
      .filter((arrow) => arrow.from === box.id)
      .flatMap((arrow) => {
        const child = rank.get(arrow.to);
        return child === undefined ? [] : [child];
      });
    if (children.length > 0) rank.set(box.id, Math.min(...children) - 1);
  }
  return rank;
}

export function layoutMap(diagram: Diagram): MapLayout {
  const rank = ranks(diagram);
  const rows: MapBox[][] = [];
  for (const box of diagram.boxes) {
    const index = rank.get(box.id) ?? 0;
    (rows[index] ??= []).push(box);
  }
  const wrapped = rows
    .filter((row) => row.length > 0)
    .flatMap((row) =>
      Array.from({ length: Math.ceil(row.length / MAX_ROW) }, (_, chunk) =>
        row.slice(chunk * MAX_ROW, chunk * MAX_ROW + MAX_ROW),
      ),
    );
  const widest = Math.max(1, ...wrapped.map((row) => row.length));
  const width = widest * MAP_BOX_WIDTH + (widest - 1) * COLUMN_GAP;
  const placed = new Map<string, PlacedBox>();
  const parents = (id: string) =>
    diagram.arrows
      .filter((arrow) => arrow.to === id)
      .flatMap((arrow) => {
        const parent = placed.get(arrow.from);
        return parent ? [parent.x] : [];
      });
  wrapped.forEach((row, rowIndex) => {
    const ordered = [...row].sort((left, right) => {
      const average = (id: string) => {
        const xs = parents(id);
        return xs.length === 0
          ? width / 2
          : xs.reduce((sum, x) => sum + x, 0) / xs.length;
      };
      return average(left.id) - average(right.id);
    });
    const rowWidth =
      ordered.length * MAP_BOX_WIDTH + (ordered.length - 1) * COLUMN_GAP;
    const start = (width - rowWidth) / 2;
    ordered.forEach((box, column) => {
      placed.set(box.id, {
        ...box,
        x: start + column * (MAP_BOX_WIDTH + COLUMN_GAP),
        y: rowIndex * (MAP_BOX_HEIGHT + ROW_GAP),
      });
    });
  });
  const height =
    wrapped.length * MAP_BOX_HEIGHT + (wrapped.length - 1) * ROW_GAP;
  return { width, height, boxes: [...placed.values()] };
}
