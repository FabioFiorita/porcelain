import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { parseEntry } from '@/features/review/model/documents';
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
} from '@/features/review/model/tab-strip';

export type PaneIndex = 0 | 1;
type Stored = { panes: Pane[] };

function hasStoredLayout(key: string) {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

function readStored(key: string): Stored | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!isRecord(parsed) || !Array.isArray(parsed.panes)) return null;
    const known = (entries: unknown) =>
      Array.isArray(entries)
        ? entries.filter(
            (entry): entry is string =>
              typeof entry === 'string' && parseEntry(entry) != null,
          )
        : [];
    const panes = parsed.panes
      .map((pane: unknown) => {
        const tabs = known(isRecord(pane) ? pane.tabs : undefined);
        return {
          tabs,
          pinned: known(isRecord(pane) ? pane.pinned : undefined).filter(
            (key) => tabs.includes(key),
          ),
        };
      })
      .filter((pane, index) => index === 0 || pane.tabs.length > 0);
    return panes.length > 0 ? { panes } : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
  const storageKey = `porcelain.tabs.${worktreeId}`;
  const [hadStoredLayout] = useState(() => hasStoredLayout(storageKey));
  const [stored, setStored] = useState<Stored | null>(() =>
    readStored(storageKey),
  );
  const lastActive = useRef<[string | null, string | null]>([null, null]);
  const fallbackHandled = useRef(false);
  const pending = useRef<
    [string | null | undefined, string | null | undefined]
  >([undefined, undefined]);
  const navigate = useNavigate({ from: '/' });
  const urlActive: [string | undefined, string | undefined] = [
    entry != null && parseEntry(entry) != null ? entry : undefined,
    side != null && parseEntry(side) != null ? side : undefined,
  ];

  useEffect(() => {
    if (entry != null && parseEntry(entry) == null) {
      void navigate({
        search: (previous) => ({ ...previous, entry: undefined }),
        replace: true,
      });
    }
    if (side != null && parseEntry(side) == null) {
      void navigate({
        search: (previous) => ({ ...previous, side: undefined }),
        replace: true,
      });
    }
  }, [entry, side, navigate]);

  const current = (index: PaneIndex): string | undefined => {
    const target = pending.current[index];
    return target === undefined ? urlActive[index] : (target ?? undefined);
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
    openInPane(base[0] ?? emptyPane(), actives[0] ?? '', lastActive.current[0]),
  ];
  if (actives[0] == null) panes[0] = base[0] ?? emptyPane();
  if (actives[1] != null)
    panes[1] = openInPane(
      base[1] ?? emptyPane(),
      actives[1],
      lastActive.current[1],
    );
  else if (base[1]?.tabs.length) panes[1] = base[1];

  const persist = (next: Stored) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    setStored(next);
  };

  useEffect(() => {
    for (const index of [0, 1] as const) {
      const target = pending.current[index];
      if (
        target !== undefined &&
        (urlActive[index] ?? null) === (target ?? null)
      )
        pending.current[index] = undefined;
    }
    lastActive.current = actives;
    if (focused === 1 && panes.length < 2) setFocused(0);
    if (
      stored != null &&
      JSON.stringify(stored.panes) === JSON.stringify(panes)
    )
      return;
    persist({ panes });
  });

  const go = (updates: { entry?: string | null; side?: string | null }) => {
    if ('entry' in updates) pending.current[0] = updates.entry ?? null;
    if ('side' in updates) pending.current[1] = updates.side ?? null;
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
    panes.map((currentPane, i) => (i === index ? pane : currentPane));

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

  useEffect(() => {
    if (
      fallback == null ||
      fallbackHandled.current ||
      hadStoredLayout ||
      entry != null ||
      side != null
    )
      return;
    fallbackHandled.current = true;
    const next = { panes: [{ tabs: [fallback], pinned: [] }] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    setStored(next);
    pending.current[0] = fallback;
    void navigate({
      search: (previous) => ({ ...previous, entry: fallback }),
      replace: true,
    });
  }, [entry, fallback, hadStoredLayout, navigate, side, storageKey]);

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
      const at = actives[index] == null ? -1 : order.indexOf(actives[index]);
      goPane(index, order[(at + delta + order.length) % order.length] ?? null);
    },
  };
}
