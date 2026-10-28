import type {
  ListPullRequestsResponse,
  ReadPullRequestResponse,
} from '@porcelain/contracts/reviews';

export type PullRequestRead = ReadPullRequestResponse;

type LinkedPullRequest = Extract<
  ReadPullRequestResponse,
  { kind: 'available' }
>['pullRequest'];
type PullCheck = LinkedPullRequest['checks'][number];
type GitHubUnavailableReason = Extract<
  ReadPullRequestResponse,
  { kind: 'unavailable' }
>['reason'];
export type FoundPullRequest = Extract<
  ListPullRequestsResponse,
  { kind: 'available' }
>['pullRequests'][number];

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

function checkOutcome(check: PullCheck): Exclude<PullChecksTone, 'none'> {
  if (check.status !== 'COMPLETED') return 'running';
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
  const failed = checks.filter((check) => checkOutcome(check) === 'failed');
  if (failed.length > 0)
    return {
      tone: 'failed',
      label: `${failed.length} of ${total} checks failed`,
      short: `${failed.length} failed`,
    };
  const running = checks.filter((check) => checkOutcome(check) === 'running');
  if (running.length > 0)
    return {
      tone: 'running',
      label: `${running.length} of ${total} checks running`,
      short: `${running.length} running`,
    };
  return {
    tone: 'passed',
    label: `${total} ${checks.length === 1 && !truncated ? 'check' : 'checks'} passed`,
    short: `${total} ${checks.length === 1 && !truncated ? 'check' : 'checks'}`,
  };
}

export function pullCheckTone(
  check: PullCheck,
): Exclude<PullChecksTone, 'none'> {
  return checkOutcome(check);
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
          'No signed-in account can open this repository. Choose one in Settings › Reviews & Git.',
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

export function foundPullRequests(
  pullRequests: readonly FoundPullRequest[],
  branch: string,
  reviewId: string,
) {
  return pullRequests
    .filter((pull) => pull.headBranch === branch && pull.state === 'open')
    .map((pull) => ({
      pull,
      heldBy:
        pull.reviewId !== undefined && pull.reviewId !== reviewId
          ? pull.reviewId
          : undefined,
    }));
}

export function pullCheckDuration(
  durationMs: number | undefined,
): string | undefined {
  if (durationMs === undefined) return undefined;
  const seconds = Math.floor(durationMs / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
