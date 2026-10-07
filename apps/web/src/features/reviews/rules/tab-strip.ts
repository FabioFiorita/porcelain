import { parseEntry, withDocument } from './documents';

export type Pane = {
  readonly tabs: readonly string[];
  readonly pinned: readonly string[];
};

export const emptyPane = (): Pane => ({ tabs: [], pinned: [] });

export function orderedTabs(pane: Pane): string[] {
  return [
    ...pane.pinned.filter((key) => pane.tabs.includes(key)),
    ...pane.tabs.filter((key) => !pane.pinned.includes(key)),
  ];
}

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

export function neighbourAfterClose(
  before: Pane,
  key: string,
  after: Pane,
): string | null {
  const order = orderedTabs(before);
  const remaining = new Set(orderedTabs(after));
  const index = order.indexOf(key);
  if (index === -1) return null;
  const candidates = [
    ...order.slice(index + 1),
    ...order.slice(0, index).reverse(),
  ];
  return candidates.find((candidate) => remaining.has(candidate)) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function knownEntries(entries: unknown): string[] {
  return Array.isArray(entries)
    ? entries.filter(
        (entry): entry is string =>
          typeof entry === 'string' && (parseEntry(entry) ?? null) !== null,
      )
    : [];
}

export function parseTabLayout(value: unknown): Pane[] | null {
  if (!isRecord(value) || !Array.isArray(value.panes)) return null;
  const panes = value.panes
    .map((pane: unknown) => {
      const tabs = knownEntries(isRecord(pane) ? pane.tabs : undefined);
      return {
        tabs,
        pinned: knownEntries(isRecord(pane) ? pane.pinned : undefined).filter(
          (key) => tabs.includes(key),
        ),
      };
    })
    .filter((pane, index) => index === 0 || pane.tabs.length > 0);
  return panes.length > 0 ? panes : null;
}
