import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { parseEntry } from '../rules/documents';
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
} from '../rules/tab-strip';
import { useTabLayoutStore } from '../store';
import type { SetWorkspaceSearch } from '@/shared/workspace/search';

export type PaneIndex = 0 | 1;
type Target = string | null | undefined;

export function useTabLayout({
  worktreeId,
  entry,
  side,
  onSearch,
  fallback,
  focused,
  setFocused,
  ready,
  focusBoundary,
}: {
  worktreeId: string;
  entry: string | undefined;
  side: string | undefined;
  onSearch: SetWorkspaceSearch;
  fallback: string | null;
  ready: boolean;
  focused: PaneIndex;
  setFocused: (pane: PaneIndex) => void;
  focusBoundary: RefObject<HTMLElement | null>;
}) {
  const { panes: stored, saved, save } = useTabLayoutStore(worktreeId);
  const [pending, setPending] = useState<[Target, Target]>([
    undefined,
    undefined,
  ]);
  const [lastActive, setLastActive] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const fallbackHandled = useRef(false);
  const paneElements = useRef<[HTMLElement | null, HTMLElement | null]>([
    null,
    null,
  ]);
  const destinationFocus = useRef<{ pane: PaneIndex; key: string } | null>(
    null,
  );
  const focusFrame = useRef<number | null>(null);
  const cancelFocusFrame = () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = null;
  };
  const cancelDestinationFocus = () => {
    destinationFocus.current = null;
    cancelFocusFrame();
  };
  const urlActive: [string | undefined, string | undefined] = [
    entry !== null &&
    entry !== undefined &&
    (parseEntry(entry) ?? null) !== null
      ? entry
      : undefined,
    side !== null && side !== undefined && (parseEntry(side) ?? null) !== null
      ? side
      : undefined,
  ];

  useEffect(() => {
    if (!ready) return;
    if (
      entry !== null &&
      entry !== undefined &&
      (parseEntry(entry) ?? null) === null
    )
      onSearch({ entry: undefined }, { replace: true });
    if (
      side !== null &&
      side !== undefined &&
      (parseEntry(side) ?? null) === null
    )
      onSearch({ side: undefined }, { replace: true });
  }, [entry, side, onSearch, ready]);

  const current = (index: PaneIndex): string | undefined => {
    const target = pending[index];
    return target === undefined ? urlActive[index] : (target ?? undefined);
  };

  const base: readonly Pane[] = stored ?? [
    fallback === null || fallback === undefined
      ? emptyPane()
      : { tabs: [fallback], pinned: [] },
  ];
  const actives: [string | null, string | null] = [
    current(0) ??
      (stored === null || stored === undefined
        ? fallback
        : (orderedTabs(base[0] ?? emptyPane()).at(-1) ?? null)),
    current(1) ??
      (base[1] === null || base[1] === undefined
        ? null
        : (orderedTabs(base[1]).at(-1) ?? null)),
  ];

  const panes: Pane[] = [
    openInPane(base[0] ?? emptyPane(), actives[0] ?? '', lastActive[0]),
  ];
  if (actives[0] === null || actives[0] === undefined)
    panes[0] = base[0] ?? emptyPane();
  if (actives[1] !== null && actives[1] !== undefined)
    panes[1] = openInPane(base[1] ?? emptyPane(), actives[1], lastActive[1]);
  else if (base[1]?.tabs.length) panes[1] = base[1];
  const split = panes.length > 1;

  useEffect(() => {
    if (!ready) return;
    const settled = pending.map((target, index) =>
      target !== undefined && (urlActive[index] ?? null) === (target ?? null)
        ? undefined
        : target,
    );
    if (settled[0] !== pending[0] || settled[1] !== pending[1])
      setPending([settled[0], settled[1]]);
    if (lastActive[0] !== actives[0] || lastActive[1] !== actives[1])
      setLastActive(actives);
    if (focused === 1 && !split) setFocused(0);
    if (
      stored !== null &&
      stored !== undefined &&
      JSON.stringify(stored) === JSON.stringify(panes)
    )
      return;
    save(panes);
  });

  const go = (updates: { entry?: string | null; side?: string | null }) => {
    cancelDestinationFocus();
    setPending((previous) => [
      'entry' in updates ? (updates.entry ?? null) : previous[0],
      'side' in updates ? (updates.side ?? null) : previous[1],
    ]);
    onSearch({
      ...('entry' in updates ? { entry: updates.entry ?? undefined } : {}),
      ...('side' in updates ? { side: updates.side ?? undefined } : {}),
    });
  };
  const goPane = (index: PaneIndex, key: string | null) =>
    go(index === 0 ? { entry: key } : { side: key });
  const replacePane = (index: PaneIndex, pane: Pane) =>
    panes.map((currentPane, i) => (i === index ? pane : currentPane));

  const settle = (index: PaneIndex, next: Pane, activeAfter: string | null) => {
    cancelDestinationFocus();
    if (split && next.tabs.length === 0) {
      const other: PaneIndex = index === 0 ? 1 : 0;
      save([panes[other] ?? emptyPane()]);
      setFocused(0);
      go({ entry: actives[other], side: null });
      return;
    }
    save(replacePane(index, next));
    if (activeAfter !== actives[index]) goPane(index, activeAfter);
  };

  useEffect(() => {
    if (
      !ready ||
      fallback === null ||
      fallback === undefined ||
      fallbackHandled.current ||
      saved ||
      (entry !== null && entry !== undefined) ||
      (side !== null && side !== undefined)
    )
      return;
    fallbackHandled.current = true;
    save([{ tabs: [fallback], pinned: [] }]);
    setPending((previous) => [fallback, previous[1]]);
    onSearch({ entry: fallback }, { replace: true });
  }, [entry, fallback, saved, onSearch, side, save, ready]);

  const currentDestinationFocus = () => {
    const target = destinationFocus.current;
    if (
      target !== null &&
      (focused !== target.pane ||
        actives[target.pane] !== target.key ||
        !panes[target.pane]?.tabs.includes(target.key))
    ) {
      cancelDestinationFocus();
      return null;
    }
    return target;
  };

  const focusDestination = () => {
    if (destinationFocus.current === null || focusFrame.current !== null)
      return;
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const target = currentDestinationFocus();
      if (target === null || focusBoundary.current?.isConnected) return;
      const tab = [
        ...(paneElements.current[target.pane]?.querySelectorAll<HTMLElement>(
          '[role="tab"]',
        ) ?? []),
      ].find((element) => element.dataset.entry === target.key);
      if (tab === undefined || !tab.isConnected) return;
      tab.focus();
      if (
        tab.ownerDocument.activeElement === tab &&
        destinationFocus.current === target
      )
        destinationFocus.current = null;
    });
  };

  useLayoutEffect(() => {
    cancelFocusFrame();
    currentDestinationFocus();
    focusDestination();
    return cancelFocusFrame;
  });

  return {
    focusDestination,
    hasDestinationFocus() {
      return currentDestinationFocus() !== null;
    },
    selectPane(index: PaneIndex) {
      cancelDestinationFocus();
      setFocused(index);
    },
    focusPane(index: PaneIndex, element: Element) {
      const target = destinationFocus.current;
      if (
        target !== null &&
        (target.pane !== index ||
          element.getAttribute('role') !== 'tab' ||
          element.getAttribute('data-entry') !== target.key)
      )
        cancelDestinationFocus();
      setFocused(index);
    },
    bindPane(index: PaneIndex, element: HTMLElement | null) {
      paneElements.current[index] = element;
      if (element !== null) focusDestination();
    },
    split,
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
        active !== null && active !== undefined && next.tabs.includes(active)
          ? active
          : (orderedTabs(next)[0] ?? null),
      );
    },
    togglePin(index: PaneIndex, key: string) {
      save(
        replacePane(index, togglePinInPane(panes[index] ?? emptyPane(), key)),
      );
    },
    openToSide(index: PaneIndex, key: string) {
      const target: PaneIndex = index === 0 ? 1 : 0;
      const next = [...panes];
      next[target] = openInPane(
        panes[target] ?? emptyPane(),
        key,
        actives[target],
      );
      save(next);
      goPane(target, key);
      destinationFocus.current = { pane: target, key };
      setFocused(target);
    },
    step(index: PaneIndex, delta: number) {
      cancelDestinationFocus();
      const order = orderedTabs(panes[index] ?? emptyPane());
      if (order.length === 0) return;
      const at =
        actives[index] === null || actives[index] === undefined
          ? -1
          : order.indexOf(actives[index]);
      goPane(index, order[(at + delta + order.length) % order.length] ?? null);
    },
  };
}
