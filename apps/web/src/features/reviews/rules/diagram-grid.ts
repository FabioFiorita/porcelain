type Box = { id: string; lane: number; height: number };

export function diagramGrid(
  lanes: readonly string[],
  boxes: readonly Box[],
  availableWidth: number,
  selected?: string,
) {
  const center = boxes.find((box) => box.id === selected);
  if (center) return traceGrid(boxes, center, availableWidth);
  const boxWidth = 240;
  const gap = 28;
  const padding = 16;
  const columns = Math.max(
    1,
    Math.min(
      3,
      Math.floor((availableWidth - padding * 2 + gap) / (boxWidth + gap)),
    ),
  );
  const widest = Math.min(
    columns,
    Math.max(
      1,
      ...lanes.map(
        (_, lane) => boxes.filter((box) => box.lane === lane).length,
      ),
    ),
  );
  const width = padding * 2 + widest * boxWidth + (widest - 1) * gap;
  const positions = new Map<string, { x: number; y: number }>();
  const bands: { label: string; y: number; height: number }[] = [];
  let top = 0;
  lanes.forEach((label, lane) => {
    const band = boxes.filter((box) => box.lane === lane);
    let rowTop = top + 36;
    for (let first = 0; first < band.length; first += columns) {
      const row = band.slice(first, first + columns);
      row.forEach((box, column) =>
        positions.set(box.id, {
          x: padding + column * (boxWidth + gap),
          y: rowTop,
        }),
      );
      rowTop += Math.max(64, ...row.map((box) => box.height)) + 40;
    }
    const height = Math.max(88, rowTop - top - 24);
    bands.push({ label, y: top, height });
    top += height + 44;
  });
  return { positions, bands, width, height: Math.max(0, top - 44) };
}

function traceGrid(boxes: readonly Box[], center: Box, availableWidth: number) {
  const wide = availableWidth >= 556;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(center.id, { x: wide ? 16 : 40, y: 36 });
  let top = wide ? 36 : 36 + Math.max(64, center.height) + 48;
  for (const box of boxes) {
    if (box.id === center.id) continue;
    positions.set(box.id, { x: wide ? 300 : 40, y: top });
    top += Math.max(64, box.height) + 48;
  }
  const height = Math.max(36 + center.height + 16, top - 32);
  return {
    positions,
    bands: [{ label: 'Ownership trace', y: 0, height }],
    width: wide ? 556 : 296,
    height,
  };
}
