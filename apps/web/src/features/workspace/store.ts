import { useId } from 'react';
import type { CodeViewHandle } from '@pierre/diffs/react';
import type { CodeViewLineSelection } from '@pierre/diffs';
import type { CreateCommentThreadRequest } from '@porcelain/contracts/reviews';
import type {
  CommentAnchor,
  FileCommentAnchor,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { atomRegistry } from '@/shared/store';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useAtomSet, useAtomValue, useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Option, Schema, SchemaGetter } from 'effect';
import { storageRuntime } from '@/shared/adapters/storage';
import { parseCodeFolds, withFolds } from './rules/code-folds';
import { type Pane, parseTabLayout } from './rules/tab-strip';
import { releaseTitle, type OwnedTitle } from './rules/first-document-title';

const savedFlag = Schema.decodeUnknownOption(
  Schema.Struct({ saved: Schema.Boolean }),
);

type CommentDraftTarget =
  | {
      kind: 'create';
      anchor: CommentAnchor;
      quote?: string | undefined;
      questionId?: string | undefined;
    }
  | { kind: 'reply'; threadId: string }
  | { kind: 'edit'; threadId: string; messageId: string };

export function commentDraftKey(
  environmentId: string,
  scope: ReviewScope,
  target: CommentDraftTarget,
) {
  const anchor = target.kind === 'create' ? target.anchor : undefined;
  const draftTarget =
    target.kind === 'create' &&
    anchor?.kind === 'change' &&
    anchor.comparison?.kind === 'branch' &&
    !scope.review
      ? { ...target, anchor: { ...anchor, revision: undefined } }
      : target;
  return JSON.stringify([
    environmentId,
    scope.review?.reviewId ?? scope.worktreeId,
    scope.review?.revision,
    draftTarget,
  ]);
}

export const newCommentDraftState = Atom.family((_target: string) =>
  Atom.make<{
    body: string;
    error?: string | undefined;
    pending?:
      | (CreateCommentThreadRequest & { threadId: string; messageId: string })
      | undefined;
  }>({ body: '' }).pipe(Atom.keepAlive),
);

export const replyCommentDraftState = Atom.family((_target: string) =>
  Atom.make<{
    body: string;
    pending?: { body: string; messageId: string } | undefined;
  }>({ body: '' }).pipe(Atom.keepAlive),
);

export const editCommentDraftState = Atom.family((_target: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive),
);
const savedFocus = Schema.decodeUnknownOption(
  Schema.Struct({ focused: Schema.Literals([0, 1]) }),
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
      focused: Schema.Literals([0, 1]),
    }),
    {
      decode: SchemaGetter.transform((value) => ({
        panes: parseTabLayout(value),
        saved: savedFlag(value).pipe(
          Option.map((saved) => saved.saved),
          Option.getOrElse(() => true),
        ),
        focused: savedFocus(value).pipe(
          Option.map((layout) => layout.focused),
          Option.getOrElse(() => 0 as const),
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
    defaultValue: () => ({ panes: null, saved: false, focused: 0 as const }),
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
  const { panes, saved, focused } = useAtomValue(atom);
  const set = useAtomSet(atom);
  const registry = useAtomValue(atomRegistry);
  return {
    panes,
    saved,
    focused,
    setFocused: (focused: 0 | 1) => {
      const current = registry.get(atom);
      if (current.focused !== focused)
        registry.set(atom, { ...current, focused });
    },
    save: (panes: readonly Pane[]) =>
      set((current) => ({ ...current, panes, saved: true })),
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

type CodeScroll = Pick<CodeViewHandle<undefined, undefined>, 'scrollTo'>;
export const branchFilesShown = Atom.family((_comparison: string) =>
  Atom.make(DIFF_WINDOW_FILES).pipe(Atom.keepAlive),
);
const codeViewScroll = Atom.family((_owner: string) =>
  Atom.make<{
    viewer: CodeScroll | null;
    restored: { viewer: CodeScroll; owner: string } | null;
  }>({ viewer: null, restored: null }),
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
      registry.get(atom).viewer?.scrollTo(request),
    restorePosition: (viewer: CodeScroll, headerHeight: number) => {
      const state = registry.get(atom);
      if (state.restored?.viewer === viewer && state.restored.owner === owner)
        return;
      viewer.scrollTo({
        type: 'position',
        position: registry.get(place).scrollTop + headerHeight,
        behavior: 'instant',
      });
      registry.set(atom, { ...state, restored: { viewer, owner } });
    },
    attach: (viewer: CodeScroll | null) => {
      if (!viewer) return;
      registry.set(atom, { ...registry.get(atom), viewer });
      return () => {
        const state = registry.get(atom);
        if (state.viewer === viewer)
          registry.set(atom, { ...state, viewer: null });
      };
    },
  };
}

export { tabs as tabLayoutState };

const reviewPanelOpen = Atom.kvs({
  runtime: storageRuntime,
  key: 'porcelain.review-panel.open',
  schema: Schema.Boolean,
  defaultValue: () => true,
}).pipe(Atom.keepAlive);
export function useReviewPanelOpen() {
  return {
    open: useAtomValue(reviewPanelOpen),
    setOpen: useAtomSet(reviewPanelOpen),
  };
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

export const firstDocumentTitle = Atom.family((_worktreeId: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive),
);

const titleOwners = new Map<string, OwnedTitle>();

export const firstDocumentTitleOwner = Atom.family(
  (input: { worktreeId: string; title: string | undefined }) =>
    Atom.make((get) => {
      const owner = Symbol();
      titleOwners.set(input.worktreeId, { owner, title: input.title });
      get.set(firstDocumentTitle(input.worktreeId), input.title);
      get.addFinalizer(() => {
        if (releaseTitle(titleOwners.get(input.worktreeId), owner)) return;
        titleOwners.delete(input.worktreeId);
        get.set(firstDocumentTitle(input.worktreeId), undefined);
      });
    }),
);
