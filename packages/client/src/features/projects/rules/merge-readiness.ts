import {
  checkState,
  pullRequestBlockers,
  type PullStatus,
} from './pull-request-checks.ts';
import {
  pullRequestMergeBlock,
  type PullChecksTone,
  type PullRequestMergeReview,
} from './pull-request.ts';

type MergeReadinessTone =
  | 'ready'
  | 'failed'
  | 'waiting'
  | 'unknown'
  | 'merged'
  | 'closed';

export type MergeReadiness = {
  readonly tone: MergeReadinessTone;
  readonly label: string;
  readonly reasons: readonly MergeReason[];
  readonly waitsFor: string | undefined;
};

type MergeReason = {
  readonly text: string;
  readonly blocksMerge: boolean;
  readonly failed: boolean;
};

const phrase = (sentence: string) =>
  `${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`.replace(/\.$/, '');

function unnamedReasons(
  status: PullStatus,
  baseBranch: string,
  mergeMethods: readonly string[] | undefined,
  review: PullRequestMergeReview | undefined,
): MergeReason[] {
  const listed = pullRequestBlockers(status, baseBranch, mergeMethods);
  if (listed.length > 0)
    return listed.map((blocker) => ({
      text: phrase(blocker.text),
      blocksMerge: false,
      failed: blocker.tone === 'failed',
    }));
  const refused = pullRequestMergeBlock(
    { ...status, baseBranch, mergeMethods: undefined },
    review,
  );
  return refused === undefined
    ? []
    : [{ text: phrase(refused), blocksMerge: true, failed: false }];
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function githubReasons(
  status: PullStatus,
  baseBranch: string,
  mergeMethods: readonly string[] | undefined,
): MergeReason[] {
  const reasons: MergeReason[] = [];
  if (mergeMethods?.length === 0)
    reasons.push({
      text: 'no merge method allowed',
      blocksMerge: true,
      failed: false,
    });
  if (status.draft)
    reasons.push({ text: 'draft', blocksMerge: true, failed: false });
  if (status.mergeable === 'CONFLICTING')
    reasons.push({
      text: `conflicts with ${baseBranch}`,
      blocksMerge: true,
      failed: true,
    });
  else if (status.mergeState === 'BEHIND')
    reasons.push({
      text: `behind ${baseBranch}`,
      blocksMerge: false,
      failed: false,
    });
  const failed = status.checks.filter(
    (check) => checkState(check) === 'failed',
  ).length;
  if (failed > 0)
    reasons.push({
      text: `${plural(failed, 'check', 'checks')} failing`,
      blocksMerge: true,
      failed: true,
    });
  const running = status.checks.filter(
    (check) => checkState(check) === 'running',
  ).length;
  if (running > 0)
    reasons.push({
      text: `${plural(running, 'check', 'checks')} running`,
      blocksMerge: true,
      failed: false,
    });
  if (status.reviewDecision === 'CHANGES_REQUESTED')
    reasons.push({
      text: 'changes requested',
      blocksMerge: true,
      failed: true,
    });
  else if (status.reviewDecision === 'REVIEW_REQUIRED')
    reasons.push({
      text: 'review required',
      blocksMerge: true,
      failed: false,
    });
  if (reasons.length === 0 && status.mergeState === 'BLOCKED')
    reasons.push({
      text: 'a branch rule on GitHub blocks it',
      blocksMerge: false,
      failed: false,
    });
  return reasons;
}

function callReasons(
  status: PullStatus,
  review: PullRequestMergeReview | undefined,
): MergeReason[] {
  if (!review) return [];
  if (review.headOid !== status.headSha)
    return [
      {
        text: 'the Walkthrough is for another commit',
        blocksMerge: false,
        failed: false,
      },
    ];
  if (review.undecidedCallStep === 'reading')
    return [{ text: 'reading your calls', blocksMerge: true, failed: false }];
  if (review.undecidedCallStep === 'unreadable')
    return [
      {
        text: 'your calls could not be read',
        blocksMerge: true,
        failed: false,
      },
    ];
  if (review.undecidedCallStep === undefined) return [];
  const open = Math.max(review.undecidedCalls ?? 1, 1);
  return [
    {
      text: `${plural(open, 'call', 'calls')} open`,
      blocksMerge: true,
      failed: false,
    },
  ];
}

export function mergeReadiness({
  status,
  baseBranch,
  mergeMethods,
  review,
}: {
  status: PullStatus | undefined;
  baseBranch: string;
  mergeMethods?: readonly string[] | undefined;
  review?: PullRequestMergeReview | undefined;
}): MergeReadiness {
  if (!status)
    return {
      tone: 'unknown',
      label: 'Reading the merge status',
      reasons: [],
      waitsFor: undefined,
    };
  if (status.state === 'merged')
    return {
      tone: 'merged',
      label: 'Merged',
      reasons: [],
      waitsFor: undefined,
    };
  if (status.state === 'closed')
    return {
      tone: 'closed',
      label: 'Closed without merging',
      reasons: [],
      waitsFor: undefined,
    };
  const named = [
    ...githubReasons(status, baseBranch, mergeMethods),
    ...callReasons(status, review),
  ];
  const reasons =
    named.length > 0
      ? named
      : unnamedReasons(status, baseBranch, mergeMethods, review);
  const blocking = reasons.filter((reason) => reason.blocksMerge);
  const waitsFor =
    blocking.length === 0
      ? undefined
      : `Merge waits for: ${reasons.map((reason) => reason.text).join(', ')}.`;
  if (reasons.length === 0)
    return { tone: 'ready', label: 'Ready to merge', reasons, waitsFor };
  const reading = reasons.some(
    (reason) => reason.text === 'reading your calls',
  );
  return {
    tone: reasons.some((reason) => reason.failed)
      ? 'failed'
      : reading
        ? 'unknown'
        : 'waiting',
    label: `Not ready to merge: ${reasons.map((reason) => reason.text).join(', ')}`,
    reasons,
    waitsFor,
  };
}

const STANDING_ICONS: Record<MergeReadinessTone, PullChecksTone> = {
  ready: 'passed',
  failed: 'failed',
  waiting: 'none',
  unknown: 'running',
  merged: 'passed',
  closed: 'none',
};

type StandingPull = {
  readonly status: PullStatus | undefined;
  readonly statusUnread: boolean;
  readonly detail:
    | {
        readonly state: string;
        readonly draft: boolean;
        readonly baseBranch: string;
        readonly mergeMethods?: readonly string[] | undefined;
      }
    | undefined;
};

function pullStateWord(pull: StandingPull) {
  const detail = pull.status ?? pull.detail;
  if (!detail) return undefined;
  if (detail.state === 'open') return detail.draft ? 'Draft' : 'Open';
  return detail.state === 'merged' ? 'Merged' : 'Closed';
}

export function walkthroughStanding({
  pull,
  review,
}: {
  pull: StandingPull | undefined;
  review: PullRequestMergeReview | undefined;
}):
  | {
      readonly label: string | undefined;
      readonly icon: PullChecksTone;
      readonly quiet: boolean;
      readonly pullState: string | undefined;
    }
  | undefined {
  const open =
    review && typeof review.undecidedCallStep === 'number'
      ? Math.max(review.undecidedCalls ?? 1, 1)
      : 0;
  const readiness =
    pull && !pull.statusUnread
      ? mergeReadiness({
          status: pull.status,
          baseBranch: pull.detail?.baseBranch ?? 'the base branch',
          mergeMethods: pull.detail?.mergeMethods,
          review,
        })
      : undefined;
  const label =
    readiness?.label ??
    (open > 0 ? `${plural(open, 'call', 'calls')} open` : undefined);
  if (!label && !pull) return undefined;
  return {
    label,
    icon: readiness ? STANDING_ICONS[readiness.tone] : 'none',
    quiet: readiness?.tone === 'unknown',
    pullState: pull ? pullStateWord(pull) : undefined,
  };
}

export function mergeButtonReason(
  block: string | undefined,
  waitsFor: string | undefined,
) {
  return block === undefined ? undefined : (waitsFor ?? block);
}
