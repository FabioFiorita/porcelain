import type { ReviewMarks, ReviewRecord } from './review.ts';
import type { ReviewRevision } from './verdict.ts';
import type {
  ListPullRequestsResponse,
  ReadPullRequestResponse,
} from '@porcelain/contracts/reviews';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

type ReviewListGroup = 'Needs you' | 'Waiting on agent' | 'Decisions reviewed';
type ReviewListBadge = {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
};

export function decisionMarked(
  marks: ReviewMarks['decisions'] | undefined,
  layer: Pick<
    ReviewRevision['content']['layers'][number],
    'id' | 'fingerprint'
  >,
) {
  return (
    marks?.some(
      (mark) =>
        mark.layerId === layer.id && mark.fingerprint === layer.fingerprint,
    ) === true
  );
}

export function reviewListStatus({
  revision,
  marks,
  status,
  pull,
}: {
  revision: Pick<ReviewRevision, 'content' | 'verdict'> | undefined;
  marks: ReviewMarks | undefined;
  status: ReadInventoryResponse['projects'][number]['worktrees'][number]['status'];
  pull?: ReviewPullState;
}) {
  const layers = revision?.content.layers ?? [];
  const reviewed = layers.filter((layer) =>
    decisionMarked(marks?.decisions, layer),
  ).length;
  const total = layers.length;
  const complete = marks !== undefined && total > 0 && reviewed === total;
  const replied = status === 'replied';
  const notice = reviewPullRequestNotice(pull);
  const group: ReviewListGroup =
    notice || replied
      ? 'Needs you'
      : complete
        ? 'Decisions reviewed'
        : status === 'reviewed'
          ? 'Waiting on agent'
          : 'Needs you';
  const badges: ReviewListBadge[] = [];
  if (notice)
    badges.push({
      label: notice,
      variant: pull?.kind === 'loading' ? 'outline' : 'destructive',
    });
  if (revision?.content.proof.checks.some((check) => check.result === 'fail'))
    badges.push({ label: 'Proof failed', variant: 'destructive' });
  const unexplained = revision?.content.notExplained.length ?? 0;
  if (unexplained > 0)
    badges.push({ label: `${unexplained} not explained`, variant: 'outline' });
  if (replied) badges.push({ label: 'Agent replied', variant: 'default' });
  if (revision)
    badges.push({
      label:
        revision.verdict.recommendation === 'hold'
          ? 'Agent says hold'
          : 'Recommends merge',
      variant: 'secondary',
    });
  if (group === 'Waiting on agent')
    badges.push({ label: 'Waiting for a commit', variant: 'secondary' });
  return { reviewed, total, group, badges };
}

type ReviewPullState =
  | { kind: 'available'; pullRequest: { state: 'open' | 'closed' | 'merged' } }
  | Exclude<ReadPullRequestResponse, { kind: 'available' }>
  | { kind: 'loading' | 'failed' }
  | undefined;

export function reviewPullRequestNotice(pull: ReviewPullState) {
  if (pull?.kind === 'loading') return 'Reading pull request…';
  if (pull?.kind === 'failed') return 'PR state unavailable: request failed.';
  if (pull?.kind !== 'unavailable') return undefined;
  const reasons = {
    'gh-not-installed': 'GitHub CLI is not installed.',
    'no-accounts': 'No GitHub account is signed in.',
    'no-access': 'The GitHub account cannot access this repository.',
    'not-github': 'This repository has no GitHub remote.',
    'rate-limited': 'GitHub rate limit reached.',
    offline: 'GitHub could not be reached.',
    'invalid-response': 'GitHub returned an invalid response.',
  };
  return `PR state unavailable: ${reasons[pull.reason]}`;
}

export function reviewClosed(
  record: Pick<ReviewRecord, 'archived' | 'state'>,
  pull: ReviewPullState,
) {
  return (
    record.archived === true ||
    record.state === 'closed' ||
    (pull?.kind === 'available' &&
      pull.pullRequest !== undefined &&
      pull.pullRequest.state !== 'open')
  );
}

export function reviewArchivable(
  record: Pick<ReviewRecord, 'archived'>,
  pull: ReviewPullState,
) {
  return (
    record.archived !== true &&
    pull?.kind === 'available' &&
    pull.pullRequest !== undefined &&
    pull.pullRequest.state !== 'open'
  );
}

export function reviewListTitle(
  record: Pick<ReviewRecord, 'branch'>,
  revision: Pick<ReviewRevision, 'verdict'> | undefined,
  pullTitle: string | undefined,
) {
  return (
    pullTitle?.trim() || revision?.verdict.asked.text.trim() || record.branch
  );
}
export function checkoutFolder(path: string) {
  const trimmed = path.replace(/(?<=.)[\\/]+$/, '');
  const split = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return {
    name: trimmed.slice(split + 1) || trimmed,
    parent: split < 0 ? undefined : trimmed.slice(0, split || 1),
  };
}

export function pullRequestBlockHidden(
  linked: string | undefined,
  projectPullRequests: ListPullRequestsResponse | undefined,
) {
  return (
    linked === undefined &&
    projectPullRequests?.kind === 'unavailable' &&
    projectPullRequests.reason === 'not-github'
  );
}

export function pullRequestLink(text: string): string | undefined {
  const match =
    /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/([1-9][0-9]*)(?:\/[^?#]*)?(?:[?#].*)?$/.exec(
      text.trim(),
    );
  return match
    ? `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`
    : undefined;
}
