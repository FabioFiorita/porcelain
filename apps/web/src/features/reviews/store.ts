import { useAtomSet, useAtomValue } from '@effect/atom-react';
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
