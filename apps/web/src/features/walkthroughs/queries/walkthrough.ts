import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readingOf,
  readWalkthrough,
  readWalkthroughAsset,
} from '@porcelain/client/walkthroughs';
import {
  walkthroughPhase,
  walkthroughTabTitle,
  worktreeOpening,
  type WorktreeOpening,
} from '@porcelain/client/walkthroughs/rules';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type {
  Connection,
  ConnectionContext,
} from '@/shared/workspace/connection';
import { readWalkthroughWriterSettings } from '@porcelain/client/projects';
import { useMountedRead } from '@/shared/query/mounted-read';
import { useBranchChanges } from '@/features/changes/index';

function worktreeSelection(scope: ReviewScope, context: ConnectionContext) {
  return {
    connection: context.connection,
    scope: { projectId: scope.projectId, worktreeId: scope.worktreeId },
  };
}

const focusedWalkthrough = Atom.family(
  (selection: Parameters<typeof readWalkthrough>[0]) =>
    readWalkthrough(selection).pipe(
      Atom.refreshOnWindowFocus,
      Atom.setIdleTTL(0),
    ),
);

export function useWalkthrough(scope: ReviewScope, context: ConnectionContext) {
  const atom = focusedWalkthrough(worktreeSelection(scope, context));
  const result = useAtomValue(atom);
  const read = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    read,
    phase: read ? walkthroughPhase(read) : undefined,
    refresh: useAtomRefresh(atom),
  };
}

export function useWalkthroughContent(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const { phase } = useWalkthrough(scope, context);
  return phase?.kind === 'ready' ? phase : undefined;
}

export function useBranchRenames(
  scope: ReviewScope,
  context: ConnectionContext,
  base: string | undefined,
) {
  const branch = useBranchChanges(scope, context.connection, base).result;
  return Option.getOrUndefined(AsyncResult.value(branch))?.files ?? [];
}

export function useWalkthroughTabTitle(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const { read } = useWalkthrough(scope, context);
  return read ? walkthroughTabTitle(read) : 'Review';
}

export function useWorktreeFirstDocument(
  scope: ReviewScope,
  context: ConnectionContext,
): WorktreeOpening {
  const { result } = useWalkthrough(scope, context);
  return worktreeOpening({
    walkthrough: readingOf(result, (read) => read),
  });
}

const assetUrl = Atom.family(
  (input: Parameters<typeof readWalkthroughAsset>[0]) =>
    Atom.make((get) => {
      const result = get(readWalkthroughAsset(input));
      return AsyncResult.map(result, (bytes) => {
        const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)]));
        get.addFinalizer(() => URL.revokeObjectURL(url));
        return url;
      });
    }),
);

export function useWalkthroughAssetUrl(input: {
  scope: ReviewScope;
  context: ConnectionContext;
  runId: string;
  assetId: string;
}) {
  const read = {
    ...worktreeSelection(input.scope, input.context),
    runId: input.runId,
    assetId: input.assetId,
  };
  return {
    url: useAtomValue(assetUrl(read)),
    retry: useAtomRefresh(readWalkthroughAsset(read)),
  };
}

const inactiveWriters = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readWalkthroughWriterSettings>>,
    Atom.Failure<ReturnType<typeof readWalkthroughWriterSettings>>
  >(),
);

export function useWalkthroughWriters(
  connection: Connection,
  enabled: boolean,
) {
  const atom = enabled
    ? readWalkthroughWriterSettings(connection)
    : inactiveWriters;
  return {
    result: useMountedRead(atom) ?? AsyncResult.initial(),
    refresh: useAtomRefresh(atom),
  };
}
