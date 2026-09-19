import { withDocument } from './documents';

/**
 * One pane's tabs. Pinned tabs always show first, in the order they were
 * pinned; the rest follow in the order they were opened.
 */
export type Pane = { tabs: string[]; pinned: string[] };

export const emptyPane = (): Pane => ({ tabs: [], pinned: [] });

export function orderedTabs(pane: Pane): string[] {
  return [
    ...pane.pinned.filter((key) => pane.tabs.includes(key)),
    ...pane.tabs.filter((key) => !pane.pinned.includes(key)),
  ];
}

/** Opening an open tab changes nothing; a new one goes after the active tab. */
export function openInPane(
  pane: Pane,
  key: string,
  after: string | null,
): Pane {
  if (pane.tabs.includes(key)) return pane;
  return { ...pane, tabs: withDocument(pane.tabs, key, after) };
}

export function closeInPane(pane: Pane, key: string): Pane {
  return {
    tabs: pane.tabs.filter((entry) => entry !== key),
    pinned: pane.pinned.filter((entry) => entry !== key),
  };
}

/** Keeps `key` and every pinned tab. */
export function closeOthersInPane(pane: Pane, key: string): Pane {
  return {
    ...pane,
    tabs: pane.tabs.filter(
      (entry) => entry === key || pane.pinned.includes(entry),
    ),
  };
}

export function closeUnpinnedInPane(pane: Pane): Pane {
  return {
    ...pane,
    tabs: pane.tabs.filter((entry) => pane.pinned.includes(entry)),
  };
}

export function togglePinInPane(pane: Pane, key: string): Pane {
  return pane.pinned.includes(key)
    ? { ...pane, pinned: pane.pinned.filter((entry) => entry !== key) }
    : { ...pane, pinned: [...pane.pinned, key] };
}

/**
 * The tab to show once `key` leaves: its right neighbour as displayed, else its
 * left one, skipping anything that closed with it.
 */
export function neighbourAfterClose(
  before: Pane,
  key: string,
  after: Pane,
): string | null {
  const order = orderedTabs(before);
  const remaining = new Set(orderedTabs(after));
  const index = order.indexOf(key);
  const candidates = [
    ...order.slice(index + 1),
    ...order.slice(0, Math.max(index, 0)).reverse(),
  ];
  return candidates.find((candidate) => remaining.has(candidate)) ?? null;
}
