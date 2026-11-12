export type CursorRow = {
  key: string;
  depth?: number | undefined;
  folder?: 'open' | 'closed' | undefined;
};

export function moveCursor(
  rows: readonly CursorRow[],
  current: string | undefined,
  move: 'next' | 'previous',
  selected?: string,
) {
  const index = rows.findIndex((row) => row.key === current);
  if (index === -1) {
    const start = rows.find((row) => row.key === selected);
    return (start ?? (move === 'next' ? rows[0] : rows.at(-1)))?.key;
  }
  const next = move === 'next' ? index + 1 : index - 1;
  return rows[Math.min(Math.max(next, 0), rows.length - 1)]?.key;
}

export type TreeStep =
  | { kind: 'toggle'; key: string }
  | { kind: 'move'; key: string };

export function treeStep(
  rows: readonly CursorRow[],
  current: string | undefined,
  direction: 'in' | 'out',
): TreeStep | undefined {
  const index = rows.findIndex((row) => row.key === current);
  const row = rows[index];
  if (!row) return undefined;
  const depth = row.depth ?? 0;
  if (direction === 'in') {
    if (row.folder === 'closed') return { kind: 'toggle', key: row.key };
    const child = rows[index + 1];
    return row.folder === 'open' && child && (child.depth ?? 0) > depth
      ? { kind: 'move', key: child.key }
      : undefined;
  }
  if (row.folder === 'open') return { kind: 'toggle', key: row.key };
  const parent = rows
    .slice(0, index)
    .findLast((candidate) => (candidate.depth ?? 0) < depth);
  return parent ? { kind: 'move', key: parent.key } : undefined;
}

export function activeList(
  lists: readonly string[],
  chosen: string | undefined,
) {
  return chosen !== undefined && lists.includes(chosen) ? chosen : lists.at(-1);
}

export function keyedLists(lists: readonly string[], over: string | undefined) {
  return over !== undefined && lists.includes(over) ? [over] : lists;
}

export function listsOwnTab(lists: readonly string[], away: boolean) {
  return lists.length > 1 || (away && lists.length > 0);
}

export function nextList(lists: readonly string[], chosen: string | undefined) {
  const active = activeList(lists, chosen);
  const index = active === undefined ? -1 : lists.indexOf(active);
  return lists[(index + 1) % lists.length];
}
