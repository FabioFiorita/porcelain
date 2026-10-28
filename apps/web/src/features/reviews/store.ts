import { useId } from 'react';
import type { CodeViewHandle } from '@pierre/diffs/react';
import { atomRegistry } from '@/shared/store';
import { useAtomSet, useAtomValue, useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Option, Schema, SchemaGetter } from 'effect';
import { storageRuntime } from '@/shared/adapters/storage';
import { parseCodeFolds, withFolds } from './rules/code-folds';
import { type Pane, parseTabLayout } from './rules/tab-strip';

const savedFlag = Schema.decodeUnknownOption(
  Schema.Struct({ saved: Schema.Boolean }),
);
const tabsSchema = Schema.Unknown.pipe(
  Schema.decodeTo(
    Schema.Struct({
      panes: Schema.NullOr(
        Schema.Array(
          Schema.Struct({
            tabs: Schema.Array(Schema.String),
            pinned: Schema.Array(Schema.String),
          }),
        ),
      ),
      saved: Schema.Boolean,
    }),
    {
      decode: SchemaGetter.transform((value) => ({
        panes: parseTabLayout(value),
        saved: savedFlag(value).pipe(
          Option.map((saved) => saved.saved),
          Option.getOrElse(() => true),
        ),
      })),
      encode: SchemaGetter.passthrough(),
    },
  ),
);
const foldsSchema = Schema.Unknown.pipe(
  Schema.decodeTo(
    Schema.Struct({
      folded: Schema.Array(Schema.String),
      expanded: Schema.Array(Schema.String),
    }),
    {
      decode: SchemaGetter.transform(parseCodeFolds),
      encode: SchemaGetter.passthrough(),
    },
  ),
);
const tabs = Atom.family((worktreeId: string) =>
  Atom.kvs({
    runtime: storageRuntime,
    key: `porcelain.tabs.${worktreeId}`,
    schema: tabsSchema,
    defaultValue: () => ({ panes: null, saved: false }),
  }),
);
const folds = Atom.family((key: string) =>
  Atom.kvs({
    runtime: storageRuntime,
    key,
    schema: foldsSchema,
    defaultValue: () => ({ folded: [], expanded: [] }),
  }),
);

export function useTabLayoutStore(worktreeId: string) {
  const atom = tabs(worktreeId);
  const { panes, saved } = useAtomValue(atom);
  const set = useAtomSet(atom);
  return {
    panes,
    saved,
    save: (panes: readonly Pane[]) => set({ panes, saved: true }),
  };
}
export function useCodeFolds(worktreeId: string, entry: string) {
  const atom = folds(`porcelain.folds.${worktreeId}.${entry}`);
  const value = useAtomValue(atom);
  const set = useAtomSet(atom);
  return {
    folds: value,
    setCollapsed: (ids: readonly string[], collapsed: boolean) =>
      set((current) => withFolds(current, ids, collapsed)),
  };
}

const walkthroughPlace = Atom.family((worktreeId: string) =>
  Atom.kvs({
    runtime: storageRuntime,
    key: `porcelain.walkthrough.${worktreeId}`,
    schema: Schema.String,
    defaultValue: () => 'briefing',
  }),
);

const walkthroughView = Atom.family((_worktreeId: string) =>
  Atom.make<'walkthrough' | 'summary'>('walkthrough').pipe(Atom.keepAlive),
);

export function useWalkthroughPlace(worktreeId: string) {
  const place = walkthroughPlace(worktreeId);
  const view = walkthroughView(worktreeId);
  const setPlace = useAtomSet(place);
  const setView = useAtomSet(view);
  return {
    place: useAtomValue(place),
    view: useAtomValue(view),
    setView,
    setPlace: (key: string) => {
      setPlace(key);
      setView('walkthrough');
    },
  };
}

type CodeScroll = Pick<CodeViewHandle<undefined, undefined>, 'scrollTo'>;
const codeViewScroll = Atom.family((_owner: string) =>
  Atom.make<CodeScroll | null>(null),
);
export function useCodeViewScroll() {
  const atom = codeViewScroll(useId());
  useAtomMount(atom);
  const registry = useAtomValue(atomRegistry);
  return {
    scrollTo: (request: Parameters<CodeScroll['scrollTo']>[0]) =>
      registry.get(atom)?.scrollTo(request),
    attach: (viewer: CodeScroll | null) => {
      if (!viewer) return;
      registry.set(atom, viewer);
      return () => {
        if (registry.get(atom) === viewer) registry.set(atom, null);
      };
    },
  };
}

export { tabs as tabLayoutState };

const revisionSelection = Atom.family((_reviewId: string) =>
  Atom.make<{
    revision: number | undefined;
    step: string | undefined;
    request: number;
  }>({
    revision: undefined,
    step: undefined,
    request: 0,
  }).pipe(Atom.keepAlive),
);
export function useReviewRevisionSelection(reviewId: string) {
  const state = revisionSelection(reviewId);
  const selection = useAtomValue(state);
  const set = useAtomSet(state);
  return {
    ...selection,
    choose: (revision: number | undefined, step?: string) =>
      set((current) => ({ revision, step, request: current.request + 1 })),
  };
}

const reviewPanelOpen = Atom.family((_reviewId: string) =>
  Atom.make(true).pipe(Atom.keepAlive),
);
export function useReviewPanelOpen(reviewId: string) {
  const atom = reviewPanelOpen(reviewId);
  return { open: useAtomValue(atom), setOpen: useAtomSet(atom) };
}

const reviewPanelView = Atom.family((_reviewId: string) =>
  Atom.make<'layers' | 'comments'>('layers').pipe(Atom.keepAlive),
);
export function useReviewPanelView(reviewId: string) {
  const atom = reviewPanelView(reviewId);
  return { view: useAtomValue(atom), setView: useAtomSet(atom) };
}

const pullRequestLinkFocus = Atom.family((_reviewId: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
);

export function usePullRequestLinkFocus(reviewId: string) {
  const atom = pullRequestLinkFocus(reviewId);
  const requested = useAtomValue(atom);
  const set = useAtomSet(atom);
  return {
    request: () => set(true),
    attach: (element: HTMLInputElement | null) => {
      if (!element || !requested || element.disabled) return;
      element.focus();
      set(false);
    },
  };
}
