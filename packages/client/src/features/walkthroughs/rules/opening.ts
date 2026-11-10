import { firstDocument, type WalkthroughRead } from './walkthrough.ts';

export type Reading<A> =
  | { status: 'reading' }
  | { status: 'failed' }
  | { status: 'read'; value: A };

export type WorktreeOpening = {
  name: 'walkthrough' | 'changes';
  pending: boolean;
  guided: boolean;
};

function settled<A>(reading: Reading<A>) {
  return reading.status !== 'reading';
}

export function worktreeOpening(input: {
  walkthrough: Reading<WalkthroughRead>;
  branchFiles: Reading<number>;
}): WorktreeOpening {
  const read =
    input.walkthrough.status === 'read' ? input.walkthrough.value : undefined;
  const files =
    input.branchFiles.status === 'read' ? input.branchFiles.value : 0;
  const name = firstDocument({
    read: read ?? { walkthrough: undefined, outOfDate: false },
    branchHasCommits: files > 0,
  });
  return {
    name: name === 'walkthrough' ? 'walkthrough' : 'changes',
    pending: !settled(input.walkthrough) || !settled(input.branchFiles),
    guided: read?.walkthrough !== undefined,
  };
}
