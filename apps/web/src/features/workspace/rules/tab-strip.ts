import { movedPath, pathInside } from '@porcelain/client/files/rules';
import {
  canonicalEntry,
  entryKey,
  parseEntry,
  withDocument,
} from './documents';

export type Pane = {
  readonly tabs: readonly string[];
  readonly pinned: readonly string[];
};

export const emptyPane = (): Pane => ({ tabs: [], pinned: [] });

export const REVIEW_TAB = 'review';

export function permanentTab(key: string) {
  return key === REVIEW_TAB;
}

export function previewTab(key: string, pinned: boolean) {
  return !pinned && parseEntry(key)?.kind === 'file';
}

export type DocumentIds = { tab: string; panel: string };

export function documentIds(pane: string, key: string): DocumentIds {
  const id = `${pane}-${encodeURIComponent(key)}`;
  return { tab: `${id}-tab`, panel: `${id}-panel` };
}

export function sideEntry(entry: string | undefined, side?: Pane) {
  const key = canonicalEntry(entry);
  if (key === undefined || !permanentTab(key)) return key;
  return side ? orderedTabs(sidePane(side)).at(-1) : undefined;
}

function sidePane(pane: Pane): Pane {
  return {
    tabs: pane.tabs.filter((key) => !permanentTab(key)),
    pinned: pane.pinned.filter((key) => !permanentTab(key)),
  };
}

export function primaryPane(pane: Pane): Pane {
  return {
    tabs: [REVIEW_TAB, ...pane.tabs.filter((key) => !permanentTab(key))],
    pinned: pane.pinned.filter((key) => !permanentTab(key)),
  };
}

export function documentPane(
  panes: readonly Pane[],
  preferred: 0 | 1,
  key: string,
): 0 | 1 {
  if (panes[preferred]?.tabs.includes(key)) return preferred;
  const other = preferred === 0 ? 1 : 0;
  return panes[other]?.tabs.includes(key) ? other : preferred;
}

export function orderedTabs(pane: Pane): string[] {
  return [
    ...pane.tabs.filter(permanentTab),
    ...pane.pinned.filter(
      (key) => !permanentTab(key) && pane.tabs.includes(key),
    ),
    ...pane.tabs.filter(
      (key) => !permanentTab(key) && !pane.pinned.includes(key),
    ),
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
  if (permanentTab(key)) return pane;
  return {
    tabs: pane.tabs.filter((entry) => entry !== key),
    pinned: pane.pinned.filter((entry) => entry !== key),
  };
}

export function closeOthersInPane(pane: Pane, key: string): Pane {
  return {
    ...pane,
    tabs: pane.tabs.filter(
      (entry) =>
        permanentTab(entry) || entry === key || pane.pinned.includes(entry),
    ),
  };
}

export function closeUnpinnedInPane(pane: Pane): Pane {
  return {
    ...pane,
    tabs: pane.tabs.filter(
      (entry) => permanentTab(entry) || pane.pinned.includes(entry),
    ),
  };
}

export function togglePinInPane(pane: Pane, key: string): Pane {
  if (permanentTab(key)) return pane;
  return pane.pinned.includes(key)
    ? { ...pane, pinned: pane.pinned.filter((entry) => entry !== key) }
    : { ...pane, pinned: [...pane.pinned, key] };
}

export function movedEntry(key: string, from: string, to: string): string {
  const ref = parseEntry(key);
  return ref?.kind === 'file' && pathInside(ref.path, from)
    ? entryKey({ kind: 'file', path: movedPath(ref.path, from, to) })
    : key;
}

export function moveInPane(pane: Pane, from: string, to: string): Pane {
  const move = (keys: readonly string[]) => [
    ...new Set(keys.map((key) => movedEntry(key, from, to))),
  ];
  return { tabs: move(pane.tabs), pinned: move(pane.pinned) };
}

export function removedEntry(key: string, path: string) {
  const ref = parseEntry(key);
  return ref?.kind === 'file' && pathInside(ref.path, path);
}

export function closeRemovedInPane(pane: Pane, path: string): Pane {
  return {
    tabs: pane.tabs.filter((key) => !removedEntry(key, path)),
    pinned: pane.pinned.filter((key) => !removedEntry(key, path)),
  };
}

export function neighbourAfterClose(
  before: Pane,
  key: string,
  after: Pane,
): string | null {
  if (after.tabs.includes(key)) return key;
  const order = orderedTabs(before);
  const remaining = new Set(orderedTabs(after));
  const index = order.indexOf(key);
  if (index === -1) return null;
  const candidates = [
    ...order.slice(index + 1),
    ...order.slice(0, index).reverse(),
  ];
  return (
    candidates.find(
      (candidate) => remaining.has(candidate) && !permanentTab(candidate),
    ) ??
    before.tabs.find((candidate) => remaining.has(candidate)) ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function knownEntries(entries: unknown): string[] {
  return Array.isArray(entries)
    ? [
        ...new Set(
          entries.flatMap((entry: unknown) => {
            const known =
              typeof entry === 'string' ? canonicalEntry(entry) : undefined;
            return known === undefined ? [] : [known];
          }),
        ),
      ]
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
    .map((pane, index) => (index === 0 ? pane : sidePane(pane)))
    .filter((pane, index) => index === 0 || pane.tabs.length > 0);
  return panes.length > 0 ? panes : null;
}

export function openToSideText(side: 'left' | 'right' | null) {
  if (side === null) return 'Open to the side';
  if (side === 'left') return 'Open in the right pane';
  return 'Open in the left pane';
}

export function recentTabEntries(
  previous: readonly string[],
  panes: readonly Pane[],
  active: string | null,
): string[] {
  const opened = panes.flatMap((pane) => orderedTabs(pane));
  const candidates = active === null ? previous : [active, ...previous];
  const current = new Set(opened);
  return [...new Set([...candidates, ...opened])].filter((key) =>
    current.has(key),
  );
}
