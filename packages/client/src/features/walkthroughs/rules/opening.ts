import { firstDocument, type WalkthroughRead } from './walkthrough.ts';

export type Reading<A> =
  | { status: 'reading' }
  | { status: 'failed' }
  | { status: 'read'; value: A };

export type WorktreeOpening = {
  name: 'walkthrough' | 'changes';
  pending: boolean;
  guided: boolean;
  companion: boolean;
};

export function worktreeOpening(input: {
  walkthrough: Reading<WalkthroughRead>;
}): WorktreeOpening {
  const read =
    input.walkthrough.status === 'read' ? input.walkthrough.value : undefined;
  const name = firstDocument(
    read ?? { walkthrough: undefined, outOfDate: false },
  );
  return {
    name,
    pending: input.walkthrough.status === 'reading',
    guided: read?.walkthrough !== undefined,
    companion: read !== undefined && read.walkthrough === undefined,
  };
}
