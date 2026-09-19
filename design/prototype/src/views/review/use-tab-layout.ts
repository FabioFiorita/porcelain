import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { entryKey, parseEntry } from '../../domain/documents';
import {
  closeInPane,
  closeOthersInPane,
  closeUnpinnedInPane,
  emptyPane,
  neighbourAfterClose,
  openInPane,
  orderedTabs,
  type Pane,
  togglePinInPane,
} from '../../domain/tab-strip';

export type PaneIndex = 0 | 1;

type Stored = { panes: Pane[] };

/** A tab's key in its current spelling (`handoff` is now `review`); null when this build cannot open it. */
const normalize = (entry: string | undefined): string | undefined => {
  const ref = parseEntry(entry);
  return ref == null ? undefined : entryKey(ref);
};

/**
 * Tabs this build cannot open (an old `git:push`, `artifact:handoff.html`, a
 * hand-edited key) are dropped on read; old spellings are renamed.
 */
const read = (key: string): Stored | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const known = (keys: string[]) => [
      ...new Set(
        keys.flatMap((entry) => {
          const current = normalize(entry);
          return current == null ? [] : [current];
        }),
      ),
    ];
    const panes = (JSON.parse(raw) as Stored).panes.map((pane) => ({
      tabs: known(pane.tabs),
      pinned: known(pane.pinned),
    }));
    return {
      panes: panes.filter((pane, index) => index === 0 || pane.tabs.length > 0),
    };
  } catch {
    return null;
  }
};

/**
 * Tabs for one worktree, in one pane or split across two. What is open and
 * pinned lives on this device; which tab is active in each pane is the URL:
 * `entry` for the left pane, `side` for the right. The first visit opens
 * `fallback` (the review, or plain Changes). Emptying a pane collapses the split.
 */
export function useTabLayout({
  worktreeId,
  entry,
  side,
  fallback,
  focused,
  setFocused,
}: {
  worktreeId: string;
  entry: string | undefined;
  side: string | undefined;
  fallback: string | null;
  focused: PaneIndex;
  setFocused: (pane: PaneIndex) => void;
}) {
  const storageKey = `porcelain.prototype.tabs.${worktreeId}`;
  const [stored, setStored] = useState<Stored | null>(() => read(storageKey));
  /** Each pane's active tab as of the last render, so a newly opened tab lands right after it. */
  const [lastActive, setLastActive] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  /**
   * Where each pane's active tab is about to move. Closing saves the new tab list
   * and then changes the URL; until the URL catches up, the old `entry` would put
   * the closed tab straight back. `undefined` means nothing is pending.
   */
  const [pending, setPending] = useState<
    [string | null | undefined, string | null | undefined]
  >([undefined, undefined]);
  const navigate = useNavigate({ from: '/' });
  const fromUrl: [string | undefined, string | undefined] = [
    normalize(entry),
    normalize(side),
  ];

  // State adjusted while rendering (React's pattern for following new props):
  // once the URL has caught up with a pending move, follow the URL again.
  const caughtUp = pending.map(
    (target, index) =>
      target !== undefined && (fromUrl[index] ?? null) === (target ?? null),
  );
  const waiting: typeof pending = [
    caughtUp[0] ? undefined : pending[0],
    caughtUp[1] ? undefined : pending[1],
  ];
  if (caughtUp[0] === true || caughtUp[1] === true) setPending(waiting);
  const current = (index: PaneIndex): string | undefined => {
    const target = waiting[index];
    return target === undefined ? fromUrl[index] : (target ?? undefined);
  };

  const base: Pane[] = stored?.panes ?? [
    fallback == null ? emptyPane() : { tabs: [fallback], pinned: [] },
  ];
  const actives: [string | null, string | null] = [
    current(0) ??
      (stored == null
        ? fallback
        : (orderedTabs(base[0] ?? emptyPane()).at(-1) ?? null)),
    current(1) ??
      (base[1] == null ? null : (orderedTabs(base[1]).at(-1) ?? null)),
  ];

  const panes: Pane[] = [
    openInPane(base[0] ?? emptyPane(), actives[0] ?? '', lastActive[0]),
  ];
  if (actives[0] == null) panes[0] = base[0] ?? emptyPane();
  if (actives[1] != null)
    panes[1] = openInPane(base[1] ?? emptyPane(), actives[1], lastActive[1]);
  else if (base[1] != null && base[1].tabs.length > 0) panes[1] = base[1];

  // Keep what this render opened (a tab from the URL joins its pane) and what is active now.
  if (lastActive[0] !== actives[0] || lastActive[1] !== actives[1])
    setLastActive(actives);
  if (stored == null || JSON.stringify(stored.panes) !== JSON.stringify(panes))
    setStored({ panes });

  // Written to this device after every change of the tab lists.
  useEffect(() => {
    if (stored != null)
      localStorage.setItem(storageKey, JSON.stringify(stored));
  }, [stored, storageKey]);

  // A split that collapsed while its right pane had focus hands focus back to the only pane.
  useEffect(() => {
    if (focused === 1 && panes.length < 2) setFocused(0);
  }, [focused, panes.length, setFocused]);

  const persist = (next: Stored) => setStored(next);

  const go = (updates: { entry?: string | null; side?: string | null }) => {
    setPending((previous) => [
      'entry' in updates ? (updates.entry ?? null) : previous[0],
      'side' in updates ? (updates.side ?? null) : previous[1],
    ]);
    void navigate({
      search: (previous) => ({
        ...previous,
        ...('entry' in updates ? { entry: updates.entry ?? undefined } : {}),
        ...('side' in updates ? { side: updates.side ?? undefined } : {}),
      }),
    });
  };
  const goPane = (index: PaneIndex, key: string | null) =>
    go(index === 0 ? { entry: key } : { side: key });
  const replacePane = (index: PaneIndex, pane: Pane) =>
    panes.map((current, i) => (i === index ? pane : current));

  /** When a pane empties while split, the other pane becomes the only one. */
  const settle = (index: PaneIndex, next: Pane, activeAfter: string | null) => {
    if (panes.length === 2 && next.tabs.length === 0) {
      const other: PaneIndex = index === 0 ? 1 : 0;
      persist({ panes: [panes[other] ?? emptyPane()] });
      setFocused(0);
      go({ entry: actives[other], side: null });
      return;
    }
    persist({ panes: replacePane(index, next) });
    if (activeAfter !== actives[index]) goPane(index, activeAfter);
  };

  return {
    split: panes.length === 2,
    panes: panes.map((pane, index) => ({
      tabs: orderedTabs(pane),
      pinned: pane.pinned,
      active: actives[index] ?? null,
    })),
    activate(index: PaneIndex, key: string) {
      setFocused(index);
      goPane(index, key);
    },
    close(index: PaneIndex, key: string) {
      const pane = panes[index] ?? emptyPane();
      const next = closeInPane(pane, key);
      settle(
        index,
        next,
        key === actives[index]
          ? neighbourAfterClose(pane, key, next)
          : actives[index],
      );
    },
    closeOthers(index: PaneIndex, key: string) {
      settle(index, closeOthersInPane(panes[index] ?? emptyPane(), key), key);
    },
    closeUnpinned(index: PaneIndex) {
      const next = closeUnpinnedInPane(panes[index] ?? emptyPane());
      const active = actives[index];
      settle(
        index,
        next,
        active != null && next.tabs.includes(active)
          ? active
          : (orderedTabs(next)[0] ?? null),
      );
    },
    togglePin(index: PaneIndex, key: string) {
      persist({
        panes: replacePane(
          index,
          togglePinInPane(panes[index] ?? emptyPane(), key),
        ),
      });
    },
    /** Copies the tab into the other pane, creating the split if needed, and focuses it there. */
    openToSide(index: PaneIndex, key: string) {
      const target: PaneIndex = index === 0 ? 1 : 0;
      const next = [...panes];
      next[target] = openInPane(
        panes[target] ?? emptyPane(),
        key,
        actives[target],
      );
      persist({ panes: next });
      setFocused(target);
      goPane(target, key);
    },
    step(index: PaneIndex, delta: number) {
      const order = orderedTabs(panes[index] ?? emptyPane());
      if (order.length === 0) return;
      const at =
        actives[index] == null ? -1 : order.indexOf(actives[index] as string);
      goPane(index, order[(at + delta + order.length) % order.length] ?? null);
    },
  };
}
