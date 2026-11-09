import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Schema } from 'effect';
import { storageRuntime } from '@/shared/adapters/storage';

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

const reviewPanelView = Atom.family((_reviewId: string) =>
  Atom.make<'layers' | 'comments'>('layers').pipe(Atom.keepAlive),
);
export function useReviewPanelView(reviewId: string) {
  const atom = reviewPanelView(reviewId);
  return { view: useAtomValue(atom), setView: useAtomSet(atom) };
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
