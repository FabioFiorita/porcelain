import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Base64 } from 'effect/encoding';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readBranchChanges } from '@porcelain/client/changes';
import {
  readingOf,
  readWalkthrough,
  readWalkthroughAsset,
} from '@porcelain/client/walkthroughs';
import {
  walkthroughPhase,
  worktreeOpening,
} from '@porcelain/client/walkthroughs/rules';
import type { Workspace, WorktreeGuide } from '../../projects/index';

type Selection = Pick<Workspace, 'connection' | 'scope'>;

export function walkthroughSelection(workspace: Selection) {
  return { connection: workspace.connection, scope: workspace.scope };
}

export function useWalkthrough(workspace: Selection) {
  const atom = readWalkthrough(walkthroughSelection(workspace));
  const result = useAtomValue(atom);
  const read = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    phase: read ? walkthroughPhase(read) : undefined,
    refresh: useAtomRefresh(atom),
  };
}

export function useReadyWalkthrough(workspace: Selection) {
  const { phase } = useWalkthrough(workspace);
  return phase?.kind === 'ready' ? phase : undefined;
}

export function useBranchFiles(workspace: Selection) {
  const result = useAtomValue(
    readBranchChanges(walkthroughSelection(workspace)),
  );
  return Option.getOrUndefined(AsyncResult.value(result))?.files ?? [];
}

export function useWorktreeGuide(workspace: Selection): WorktreeGuide {
  const selection = walkthroughSelection(workspace);
  const walkthrough = useAtomValue(readWalkthrough(selection));
  const branch = useAtomValue(readBranchChanges(selection));
  const opening = worktreeOpening({
    walkthrough: readingOf(walkthrough, (read) => read),
    branchFiles: readingOf(branch, (answer) => answer.files.length),
  });
  return {
    walkthrough: opening.name === 'walkthrough',
    pending: opening.pending,
  };
}

const assetData = Atom.family(
  (input: Parameters<typeof readWalkthroughAsset>[0]) =>
    Atom.make((get) =>
      AsyncResult.map(get(readWalkthroughAsset(input)), (bytes) =>
        Base64.encode(Uint8Array.from(bytes)),
      ),
    ),
);

export function useWalkthroughAsset(input: {
  workspace: Selection;
  runId: string;
  assetId: string;
}) {
  return useAtomValue(
    assetData({
      ...walkthroughSelection(input.workspace),
      runId: input.runId,
      assetId: input.assetId,
    }),
  );
}
