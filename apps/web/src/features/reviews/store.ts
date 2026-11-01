import { useId } from 'react';
import type { CodeViewHandle } from '@pierre/diffs/react';
import type { CodeViewLineSelection } from '@pierre/diffs';
import type { FileCommentAnchor } from '@porcelain/client/reviews/rules';
import { atomRegistry } from '@/shared/store';
import { DIFF_WINDOW_FILES } from '@/config/limits';
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
export const tabActivationState = Atom.family((_worktreeId: string) =>
  Atom.make<readonly string[]>([]).pipe(Atom.keepAlive),
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
export const branchFilesShown = Atom.family((_comparison: string) =>
  Atom.make(DIFF_WINDOW_FILES).pipe(Atom.keepAlive),
);
const codeViewScroll = Atom.family((_owner: string) =>
  Atom.make<CodeScroll | null>(null),
);
type CodeSelection = {
  lines: CodeViewLineSelection;
  anchor: FileCommentAnchor | null;
} | null;
const codePlaces = Atom.family((_owner: string) =>
  Atom.make<{
    scrollTop: number;
    selection: CodeSelection;
    focused: string | undefined;
  }>({
    scrollTop: 0,
    selection: null,
    focused: undefined,
  }).pipe(Atom.keepAlive),
);
export function useCodeViewScroll(owner: string) {
  const atom = codeViewScroll(useId());
  useAtomMount(atom);
  const registry = useAtomValue(atomRegistry);
  const place = codePlaces(owner);
  return {
    position: () => registry.get(place).scrollTop,
    selection: () => registry.get(place).selection,
    focused: () => registry.get(place).focused,
    rememberFocus: (focused: string | undefined) =>
      registry.set(place, { ...registry.get(place), focused }),
    rememberPosition: (scrollTop: number) => {
      registry.set(place, { ...registry.get(place), scrollTop });
    },
    rememberSelection: (selection: CodeSelection) => {
      registry.set(place, { ...registry.get(place), selection });
    },
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
    request: number;
  }>({
    revision: undefined,
    request: 0,
  }).pipe(Atom.keepAlive),
);
export function useReviewRevisionSelection(reviewId: string) {
  const state = revisionSelection(reviewId);
  const selection = useAtomValue(state);
  const set = useAtomSet(state);
  return {
    ...selection,
    choose: (revision: number | undefined) =>
      set((current) => ({ revision, request: current.request + 1 })),
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
    attach: (element: HTMLInputElement | HTMLButtonElement | null) => {
      if (!element || !requested || element.disabled) return;
      element.focus();
      set(false);
    },
  };
}

const reviewFileOrigins = Atom.family((_revision: string) =>
  Atom.make<Readonly<Record<string, string>>>({}).pipe(Atom.keepAlive),
);

export function useReviewFileOrigins(reviewId: string, revision: number) {
  const atom = reviewFileOrigins(`${reviewId}:${revision}`);
  const set = useAtomSet(atom);
  return {
    steps: useAtomValue(atom),
    choose: (path: string, stepId: string) =>
      set((current) => ({ ...current, [path]: stepId })),
  };
}
