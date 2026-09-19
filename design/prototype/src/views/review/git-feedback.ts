import { toast } from '@/components/ui/toast';
import {
  type GitAction,
  gitActionLabel,
  type Receipt,
  receiptHeadline,
} from '../../domain/git-action';
import { changePath } from '../../domain/review';
import type { useChanges } from '../../query/review';

/** The list of changes as the reviewer saw it: what every Git action sends back as `expected`. */
export type Look = ReturnType<typeof useChanges>;

export const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Refused because the files, the branch or the upstream moved since the reviewer looked. */
export const changedSinceLooked = (receipt: Receipt) =>
  receipt.state === 'rejected' && receipt.reason === 'CHANGED_SINCE_LOOKED';

/** Cut off by a server restart: the interrupted-action banner says so, so no toast repeats it. */
export const leftToBanner = (receipt: Receipt) =>
  receipt.state === 'interrupted';

/** Files Git could not merge: the ones a stopped merge or rebase waits on. */
export const conflictedPaths = (status: Look) =>
  status.changes
    .filter((change) => change.scope === 'unmerged')
    .map(changePath);

/** Porcelain has no abort action; the reviewer runs this in a terminal. */
export const abortCommand = (inProgress: 'merge' | 'rebase') =>
  `git ${inProgress} --abort`;

/** Git's own words when it has any, else our headline. */
export const receiptWords = (receipt: Receipt) =>
  receipt.message ?? receiptHeadline(receipt);

/**
 * Toasts a failed receipt: Git's or the server's words, and "Look again" when the
 * refusal is "changed since you looked". Successes are worded by each caller; an
 * interrupted receipt is left to the banner.
 */
export function reportFailedReceipt(
  action: GitAction,
  receipt: Receipt,
  onLookAgain?: () => void,
) {
  if (leftToBanner(receipt)) return;
  const label = gitActionLabel(action);
  const title =
    receipt.state === 'conflicted'
      ? `${label} stopped on a conflict`
      : `${label} did not run`;
  toast.add({
    title,
    description: receiptWords(receipt),
    type: 'error',
    actionProps:
      changedSinceLooked(receipt) && onLookAgain != null
        ? { children: 'Look again', onClick: onLookAgain }
        : undefined,
  });
}

/** What changed between two looks at the list of changes, for the "changed since you looked" note. */
export function whatMoved(before: Look, after: Look) {
  const was = new Map(
    before.changes.map((change) => [changePath(change), change.fingerprint]),
  );
  const now = new Map(
    after.changes.map((change) => [changePath(change), change.fingerprint]),
  );
  const marks = new Map<string, 'changed' | 'new'>();
  for (const [key, fingerprint] of now) {
    const previous = was.get(key);
    if (previous == null) marks.set(key, 'new');
    else if (previous !== fingerprint) marks.set(key, 'changed');
  }
  const gone = [...was.keys()].filter((key) => !now.has(key));
  return { marks, gone, branchMoved: before.headOid !== after.headOid };
}
