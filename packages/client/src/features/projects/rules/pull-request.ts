import type {
  PullRequestStatus,
  ReadPullRequestResponse,
} from '@porcelain/contracts/projects';

export type PullRequestRead = ReadPullRequestResponse;

type LinkedPullRequest = Extract<
  ReadPullRequestResponse,
  { kind: 'available' }
>['pullRequest'];
type PullCheck = Pick<
  LinkedPullRequest['checks'][number],
  'name' | 'status' | 'conclusion'
>;
type GitHubUnavailableReason = Extract<
  ReadPullRequestResponse,
  { kind: 'unavailable' }
>['reason'];

export type PullRequestState = 'open' | 'draft' | 'merged' | 'closed';

export function pullRequestState(pull: {
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
}): PullRequestState {
  return pull.state === 'open' && pull.draft ? 'draft' : pull.state;
}

const pullRequestStateLabels: Record<PullRequestState, string> = {
  open: 'Open',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
};

export function pullRequestStateLabel(pull: {
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
}) {
  return pullRequestStateLabels[pullRequestState(pull)];
}

export type PullChecksTone = 'passed' | 'running' | 'failed' | 'none';
const failedConclusions = new Set([
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'STALE',
]);

const runningStatuses = new Set([
  'QUEUED',
  'IN_PROGRESS',
  'PENDING',
  'EXPECTED',
  'WAITING',
  'REQUESTED',
]);
function checkResultTone(result: string): PullChecksTone {
  if (result === 'SUCCESS') return 'passed';
  if (failedConclusions.has(result)) return 'failed';
  if (runningStatuses.has(result)) return 'running';
  return 'none';
}

const TONE_WORDS: Record<PullChecksTone, string | undefined> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  none: undefined,
};

function recordedOutcome(result: string) {
  if (result === 'SUCCESS') return 'Passed';
  if (result === 'FAILURE' || result === 'ERROR') return 'Failed';
  if (result === 'IN_PROGRESS') return 'Running';
  const words = result.toLowerCase().replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export type RecordedCheck = {
  readonly name: string;
  readonly tone: PullChecksTone;
  readonly label: string;
  readonly detail: string | undefined;
};

type CapturedChecks = {
  readonly headOid: string;
  readonly state: string;
  readonly checksTruncated: boolean;
  readonly results: readonly {
    readonly name: string;
    readonly status: string;
  }[];
};

const WRITTEN_WORDS: Record<PullChecksTone, string> = {
  passed: 'Passing when written',
  failed: 'Failing when written',
  running: 'Running when written',
  none: 'Checks when written',
};

export function recordedChecks(checks: CapturedChecks): {
  label: string;
  whenWritten: string;
  more: boolean;
  results: readonly RecordedCheck[];
} {
  const rollup = pullRequestRollup(checks.state);
  const commit = checks.headOid.slice(0, 7);
  return {
    label:
      rollup.tone === 'none'
        ? `Checks at ${commit}`
        : `${rollup.label} at ${commit}`,
    whenWritten: `${WRITTEN_WORDS[rollup.tone]}, at ${commit}`,
    more: checks.checksTruncated,
    results: checks.results.map(({ name, status }) => {
      const tone = checkResultTone(status);
      const label = recordedOutcome(status);
      return {
        name,
        tone,
        label,
        detail: label === TONE_WORDS[tone] ? undefined : label,
      };
    }),
  };
}

function checkOutcome(check: PullCheck): Exclude<PullChecksTone, 'none'> {
  if (check.status !== 'COMPLETED' || check.conclusion === 'EXPECTED')
    return 'running';
  return failedConclusions.has(check.conclusion ?? '') ? 'failed' : 'passed';
}

export function pullRequestChecks(
  checks: readonly PullCheck[],
  truncated: boolean,
  summary?: string,
): { tone: PullChecksTone; label: string; short: string } {
  const total = `${checks.length}${truncated ? '+' : ''}`;
  if (truncated) {
    const rollup = pullRequestRollup(summary);
    return rollup.tone === 'none'
      ? {
          tone: 'none',
          label: `${total} checks listed · result incomplete`,
          short: 'Checks incomplete',
        }
      : { tone: rollup.tone, label: rollup.label, short: rollup.label };
  }
  if (checks.length === 0)
    return { tone: 'none', label: 'No checks', short: 'No checks' };
  const checksLabel = `${checks.length} ${checks.length === 1 ? 'check' : 'checks'}`;
  const failed = checks.filter((check) => checkOutcome(check) === 'failed');
  if (failed.length > 0)
    return {
      tone: 'failed',
      label: `${failed.length} of ${checksLabel} failed`,
      short: `${failed.length} failed`,
    };
  const running = checks.filter((check) => checkOutcome(check) === 'running');
  if (running.length > 0)
    return {
      tone: 'running',
      label: `${running.length} of ${checksLabel} running`,
      short: `${running.length} running`,
    };
  return {
    tone: 'passed',
    label: `${checksLabel} passed`,
    short: checksLabel,
  };
}

export function currentWalkthroughChecks(
  captured: CapturedChecks,
  live:
    | {
        readonly headSha: string;
        readonly checksTruncated: boolean;
        readonly checksSummary?: string | undefined;
        readonly checks: readonly PullCheck[];
      }
    | undefined,
) {
  if (!live || live.headSha !== captured.headOid) return undefined;
  const { tone } = pullRequestChecks(
    live.checks,
    live.checksTruncated,
    live.checksSummary,
  );
  if (
    tone === 'none' &&
    (live.checksTruncated || live.checksSummary !== undefined)
  )
    return undefined;
  const capturedTone = pullRequestRollup(captured.state).tone;
  const changed = live.checks.filter((check) => {
    const previous = captured.results.find(
      (result) => result.name === check.name,
    );
    return (
      previous !== undefined &&
      checkResultTone(previous.status) !== checkOutcome(check)
    );
  });
  if (tone === capturedTone && changed.length === 0) return undefined;
  const labels: Record<PullChecksTone, string> = {
    failed: 'Failing now',
    passed: 'Passing now',
    running: 'Running now',
    none: 'No checks now',
  };
  const names = live.checks
    .filter((check) => checkOutcome(check) === tone)
    .map((check) => check.name);
  return {
    tone,
    label: labels[tone],
    names,
    changed: changed.map((check) => ({
      name: check.name,
      tone: checkOutcome(check),
      label: labels[checkOutcome(check)],
    })),
  };
}

export function recordedCheckNow(
  result: RecordedCheck,
  live: ReturnType<typeof currentWalkthroughChecks>,
): { tone: PullChecksTone; label: string; detail: string } {
  const now = live?.changed.find((check) => check.name === result.name);
  return now
    ? {
        tone: now.tone,
        label: now.label,
        detail: `${now.label} · ${result.label.toLowerCase()} when written`,
      }
    : {
        tone: result.tone,
        label: result.label,
        detail: result.detail ?? result.label,
      };
}

export function walkthroughCheckRows<
  Entry extends { readonly checks: CapturedChecks },
>(
  entries: readonly Entry[],
  live: Parameters<typeof currentWalkthroughChecks>[1],
) {
  const rows = entries.map((entry) => ({
    ...entry,
    live: currentWalkthroughChecks(entry.checks, live),
  }));
  const settled = (row: (typeof rows)[number]) => {
    const tone = pullRequestRollup(row.checks.state).tone;
    return !row.live && tone !== 'failed' && tone !== 'running';
  };
  return {
    changed: rows.filter((row) => !settled(row)),
    unchanged: rows
      .filter(settled)
      .map(({ live: _settled, ...entry }) => entry),
  };
}

export function withPullRequestStatus(
  pull: LinkedPullRequest,
  status: PullRequestStatus | undefined,
): LinkedPullRequest {
  if (!status) return pull;
  return {
    ...pull,
    state: status.state,
    draft: status.draft,
    headSha: status.headSha,
    mergeable: status.mergeable,
    checks: status.checks,
    checksTruncated: status.checksTruncated,
    checksSummary: status.checksSummary,
  };
}

export function pullRequestRollup(summary: string | undefined): {
  tone: PullChecksTone;
  label: string;
} {
  if (summary === 'SUCCESS') return { tone: 'passed', label: 'Checks passing' };
  if (summary === 'FAILURE' || summary === 'ERROR')
    return { tone: 'failed', label: 'Checks failing' };
  if (summary === 'PENDING' || summary === 'EXPECTED')
    return { tone: 'running', label: 'Checks running' };
  return { tone: 'none', label: 'No checks' };
}

type GitHubUnavailableAction =
  | { kind: 'settings'; label: 'Choose an account' }
  | { kind: 'install'; label: 'How to install'; url: string }
  | { kind: 'copy'; label: 'Copy gh auth login'; text: 'gh auth login' }
  | { kind: 'retry'; label: 'Try again' };

export function githubUnavailable(reason: GitHubUnavailableReason): {
  description: string;
  action: GitHubUnavailableAction;
} {
  switch (reason) {
    case 'no-access':
      return {
        description:
          'The chosen or detected GitHub account cannot open this repository. Choose another account or reset the choice in Settings › Changes & Git.',
        action: { kind: 'settings', label: 'Choose an account' },
      };
    case 'gh-not-installed':
      return {
        description: 'The GitHub CLI (gh) is not installed on this computer.',
        action: {
          kind: 'install',
          label: 'How to install',
          url: 'https://cli.github.com',
        },
      };
    case 'no-accounts':
      return {
        description:
          'No GitHub account is signed in. Run gh auth login on this computer.',
        action: {
          kind: 'copy',
          label: 'Copy gh auth login',
          text: 'gh auth login',
        },
      };
    case 'rate-limited':
      return {
        description: 'GitHub rate limit reached.',
        action: { kind: 'retry', label: 'Try again' },
      };
    case 'offline':
      return {
        description: 'GitHub can’t be reached.',
        action: { kind: 'retry', label: 'Try again' },
      };
    case 'invalid-response':
      return {
        description: 'GitHub’s answer was unreadable.',
        action: { kind: 'retry', label: 'Try again' },
      };
    case 'pull-request-not-found':
      return {
        description:
          'GitHub could not find this pull request. It may have been removed or become unavailable to this account. You can still read local changes.',
        action: { kind: 'retry', label: 'Try again' },
      };
    case 'not-github':
      return {
        description: 'This repository has no GitHub remote.',
        action: { kind: 'retry', label: 'Try again' },
      };
  }
}

export function pullRequestMergeable(mergeable: string): {
  label: string;
  tone: 'passed' | 'failed' | 'none';
} {
  if (mergeable === 'MERGEABLE')
    return { label: 'No conflicts', tone: 'passed' };
  if (mergeable === 'CONFLICTING')
    return { label: 'Conflicts', tone: 'failed' };
  return { label: 'Not known yet', tone: 'none' };
}

export type PullRequestMergeMethod = 'merge' | 'squash' | 'rebase';

const mergeMethodLabels: Record<PullRequestMergeMethod, string> = {
  merge: 'Create a merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
};

export function pullRequestMergeMethods(pull: {
  readonly mergeMethods?: readonly PullRequestMergeMethod[] | undefined;
}) {
  return (pull.mergeMethods ?? ['merge', 'squash', 'rebase']).map((method) => ({
    method,
    label: mergeMethodLabels[method],
  }));
}

export function mergeFailureMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'The merge could not be completed. Check the pull request before trying again.';
}

export type PullRequestMergeReview = {
  readonly headOid: string;
  readonly undecidedCallStep: number | 'reading' | 'unreadable' | undefined;
  readonly undecidedCalls?: number | undefined;
  readonly callsNeedingCommit?: readonly number[] | undefined;
};

export function pullRequestMergeBlock(
  pull: Pick<
    LinkedPullRequest,
    | 'state'
    | 'draft'
    | 'mergeable'
    | 'checks'
    | 'checksTruncated'
    | 'checksSummary'
    | 'baseBranch'
    | 'headSha'
  > & {
    readonly mergeMethods?: readonly PullRequestMergeMethod[] | undefined;
  },
  review?: PullRequestMergeReview,
): string | undefined {
  if (pull.state === 'merged') return 'Already merged.';
  if (pull.state === 'closed') return 'This pull request is closed.';
  if (pull.draft) return 'It is a draft. Mark it ready for review on GitHub.';
  if (pull.mergeMethods?.length === 0)
    return 'This repository allows no merge method.';
  if (pull.mergeable === 'CONFLICTING')
    return `It conflicts with ${pull.baseBranch}.`;
  const checks = pullRequestChecks(
    pull.checks,
    pull.checksTruncated,
    pull.checksSummary,
  );
  if (checks.tone === 'failed' || checks.tone === 'running')
    return checks.tone === 'failed'
      ? `${checks.label.replace(/^Checks failing$/, 'Checks are failing')}.`
      : `${checks.label.replace(/^Checks running$/, 'Checks are still running')}.`;
  if (!review || review.headOid !== pull.headSha) return undefined;
  if (review.undecidedCallStep === 'reading')
    return 'Reading your decisions on the calls.';
  if (review.undecidedCallStep === 'unreadable')
    return 'Your decisions on the calls could not be read.';
  if (review.undecidedCallStep !== undefined)
    return `Your call in step ${review.undecidedCallStep} is not decided yet.`;
  const needsCommit = review.callsNeedingCommit?.[0];
  if (needsCommit !== undefined)
    return `Your call in step ${needsCommit} needs a new commit.`;
  return undefined;
}

export function pullReviewState(
  state: string | undefined,
): { label: string; tone: 'passed' | 'failed' | 'none' } | undefined {
  if (state === 'APPROVED') return { label: 'Approved', tone: 'passed' };
  if (state === 'CHANGES_REQUESTED')
    return { label: 'Changes requested', tone: 'failed' };
  if (state === 'DISMISSED') return { label: 'Dismissed', tone: 'none' };
  return undefined;
}

export function pullRequestNumber(url: string): number | undefined {
  const match = /\/pull\/([1-9][0-9]*)$/.exec(url);
  return match ? Number(match[1]) : undefined;
}

export function pullRequestRepository(url: string): string | undefined {
  return /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\//.exec(url)?.[1];
}

export function pullRequestConversation(
  timeline: LinkedPullRequest['timeline'],
) {
  const reviews = new Set(
    timeline.filter((item) => item.kind === 'review').map((item) => item.id),
  );
  return timeline
    .filter(
      (item) =>
        item.kind !== 'review-comment' ||
        item.reviewId === undefined ||
        !reviews.has(item.reviewId),
    )
    .map((item) => ({
      item,
      comments:
        item.kind === 'review'
          ? timeline.filter(
              (comment) =>
                comment.kind === 'review-comment' &&
                comment.reviewId === item.id,
            )
          : [],
    }));
}

export function pullRequestCheckout(
  projects: readonly {
    readonly id: string;
    readonly available: boolean;
    readonly worktrees: readonly {
      readonly id: string;
      readonly available: boolean;
      readonly branch?: string | undefined;
    }[];
  }[],
  projectId: string,
  headBranch: string,
): { projectId: string; worktreeId: string } | undefined {
  const project = projects.find(
    (entry) => entry.id === projectId && entry.available,
  );
  const worktree = project?.worktrees.find(
    (entry) => entry.available && entry.branch === headBranch,
  );
  return worktree ? { projectId, worktreeId: worktree.id } : undefined;
}

export function undecidedCallAtHead(
  review: PullRequestMergeReview | undefined,
  headSha: string,
) {
  return review?.headOid === headSha ? review.undecidedCallStep : undefined;
}

export function pullRequestActionFailure(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'GitHub did not take the request. Try again.';
}

export function mergeConfirmation(pull: {
  readonly number: number;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly headSha: string;
}) {
  return {
    title: `Merge pull request #${pull.number}?`,
    description: `${pull.headBranch} at ${pull.headSha.slice(0, 7)} goes into ${pull.baseBranch} on GitHub. A merge cannot be undone.`,
  };
}
