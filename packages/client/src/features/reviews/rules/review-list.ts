import type { ReviewMarks, ReviewRecord } from './review.ts';
import type { ReviewRevision } from './verdict.ts';
import type {
  ListPullRequestsResponse,
  ReadPullRequestResponse,
} from '@porcelain/contracts/reviews';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export const reviewListGroups = [
  'Projects',
  'Needs you',
  'Waiting on agent',
  'Ready to merge',
  'No review',
] as const;
type ReviewListGroup = (typeof reviewListGroups)[number] | 'Closed';
type ReviewListBadge = {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
};
export type ReviewListEntry = {
  key: string;
  environmentId: string;
  environmentName: string;
  projectId: string;
  projectName: string;
  worktreeId?: string | undefined;
  path?: string | undefined;
  reviewId?: string | undefined;
  branch: string;
  detached: boolean;
  title: string;
  group: ReviewListGroup;
  closed: boolean;
  archivable?: boolean | undefined;
  archived?: boolean | undefined;
  reviewed: number;
  total: number;
  publishedAt?: string | undefined;
  pullRequestNumber?: string | undefined;
  pullRequestIssue?: string | undefined;
  badges: readonly ReviewListBadge[];
  disabled: boolean;
};

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
    marks?.decisions.some(
      (mark) =>
        mark.layerId === layer.id && mark.fingerprint === layer.fingerprint,
    ),
  ).length;
  const total = layers.length;
  const complete = marks !== undefined && total > 0 && reviewed === total;
  const replied = status === 'replied';
  const notice = reviewPullRequestNotice(pull);
  const group: ReviewListGroup =
    notice || replied
      ? 'Needs you'
      : revision?.verdict.recommendation === 'merge' && complete
        ? 'Ready to merge'
        : status === 'reviewed' || complete
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
export type ReviewListFilter = {
  projects: readonly string[] | undefined;
  environments: readonly string[] | undefined;
};
export const emptyReviewListFilter: ReviewListFilter = {
  projects: undefined,
  environments: undefined,
};
export function toggleReviewListFilter(
  values: readonly string[],
  value: string,
) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}
export function filterReviewList(
  entries: readonly ReviewListEntry[],
  query: string,
  filter: ReviewListFilter,
  closed: boolean,
) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      entry.closed === closed &&
      (filter.projects === undefined ||
        filter.projects.includes(
          `${entry.environmentId}/${entry.projectId}`,
        )) &&
      (filter.environments === undefined ||
        filter.environments.includes(entry.environmentId)) &&
      terms.every((term) =>
        [
          entry.title,
          entry.branch,
          entry.path,
          entry.projectName,
          entry.environmentName,
          entry.pullRequestNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(term),
      ),
  );
}
export function reviewListSignal(entry: ReviewListEntry) {
  const failure = entry.badges.find((badge) => badge.variant === 'destructive');
  if (failure) return { reason: failure.label, tone: 'destructive' as const };
  if (!entry.reviewId) return undefined;
  return {
    reason: entry.group,
    tone:
      entry.group === 'Ready to merge'
        ? ('primary' as const)
        : ('muted' as const),
  };
}

export function checkoutFolder(path: string) {
  const trimmed = path.replace(/(?<=.)[\\/]+$/, '');
  const split = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return {
    name: trimmed.slice(split + 1) || trimmed,
    parent: split < 0 ? undefined : trimmed.slice(0, split || 1),
  };
}

export function reviewListCheckout(entry: ReviewListEntry) {
  if (!entry.detached || !entry.path)
    return { name: entry.branch, parent: undefined, full: entry.branch };
  return { ...checkoutFolder(entry.path), full: entry.path };
}

type ReviewListCheckoutKey = Pick<
  ReviewListEntry,
  'environmentId' | 'worktreeId'
>;

export function reviewListWithoutClosedCheckouts(
  entries: readonly ReviewListEntry[],
  selected: ReviewListCheckoutKey | undefined,
) {
  const checkout = (entry: ReviewListCheckoutKey) =>
    `${entry.environmentId}/${entry.worktreeId}`;
  const closed = new Set(
    entries
      .filter((entry) => entry.closed && entry.worktreeId !== undefined)
      .map(checkout),
  );
  if (selected?.worktreeId !== undefined) closed.delete(checkout(selected));
  return entries.filter(
    (entry) => entry.group !== 'No review' || !closed.has(checkout(entry)),
  );
}

export function compareNoReviewRows(a: ReviewListEntry, b: ReviewListEntry) {
  return (
    Number(b.group === 'Projects') - Number(a.group === 'Projects') ||
    reviewListRow(a).title.localeCompare(reviewListRow(b).title) ||
    a.projectName.localeCompare(b.projectName) ||
    a.key.localeCompare(b.key)
  );
}

export function reviewListRow(entry: ReviewListEntry) {
  if (entry.reviewId)
    return {
      kind: 'review' as const,
      title: entry.title,
      progress: `${entry.reviewed}/${entry.total}`,
      project: entry.projectName,
      branch: entry.branch,
    };
  const checkout = reviewListCheckout(entry);
  return {
    kind: 'worktree' as const,
    title: checkout.name,
    project: entry.projectName,
    location: checkout.parent,
  };
}

export type ReviewListSelection =
  | { kind: 'worktree'; environmentId: string; worktreeId: string }
  | { kind: 'review'; environmentId: string; reviewId: string };

export function reviewListIsSelected(
  entry: ReviewListEntry,
  selection: ReviewListSelection | undefined,
) {
  if (!selection || entry.environmentId !== selection.environmentId)
    return false;
  return selection.kind === 'review'
    ? entry.reviewId === selection.reviewId
    : !entry.closed && entry.worktreeId === selection.worktreeId;
}

export function reviewListSections(
  entries: readonly ReviewListEntry[],
  query: string,
  filter: ReviewListFilter,
  selection: ReviewListSelection | undefined,
) {
  const active = reviewListView(
    reviewListWithoutClosedCheckouts(
      entries,
      selection?.kind === 'worktree' ? selection : undefined,
    ),
    query,
    filter,
    false,
  );
  const closed = reviewListView(entries, query, filter, true).rows;
  const noReview = active.rows
    .filter(
      (entry) => entry.group === 'No review' || entry.group === 'Projects',
    )
    .toSorted(compareNoReviewRows);
  return {
    filters: active.filters,
    rows: [...active.rows, ...closed],
    groups: [
      ...reviewListGroups.filter((group) => group !== 'Projects'),
      'Closed' as const,
    ].map((group) => ({
      group,
      rows:
        group === 'Closed'
          ? closed
          : group === 'No review'
            ? noReview
            : active.rows.filter((entry) => entry.group === group),
    })),
  };
}

export function reviewListMeta(entry: ReviewListEntry, now: number) {
  if (entry.group === 'Projects') return entry.branch;
  const seconds = entry.publishedAt
    ? Math.max(0, (now - Date.parse(entry.publishedAt)) / 1000)
    : undefined;
  const age =
    seconds === undefined
      ? undefined
      : seconds < 60
        ? 'now'
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m`
          : seconds < 86400
            ? `${Math.floor(seconds / 3600)}h`
            : `${Math.floor(seconds / 86400)}d`;
  return [
    entry.projectName,
    entry.pullRequestNumber ? `#${entry.pullRequestNumber}` : entry.branch,
    age,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function reviewListOptions(entries: readonly ReviewListEntry[]) {
  return {
    projects: [
      ...new Map(
        entries.map((entry) => [
          `${entry.environmentId}/${entry.projectId}`,
          {
            id: `${entry.environmentId}/${entry.projectId}`,
            label: `${entry.projectName} · ${entry.environmentName}`,
          },
        ]),
      ).values(),
    ],
    environments: [
      ...new Map(
        entries.map((entry) => [
          entry.environmentId,
          { id: entry.environmentId, label: entry.environmentName },
        ]),
      ).values(),
    ],
  };
}
export function reviewListFilterItems(
  options: readonly { id: string; label: string }[],
  selected: readonly string[] | undefined,
) {
  return options.map((option) => ({
    ...option,
    checked: selected === undefined || selected.includes(option.id),
    next: toggleReviewListFilter(
      selected ?? options.map((entry) => entry.id),
      option.id,
    ),
  }));
}

export function reviewListView(
  entries: readonly ReviewListEntry[],
  query: string,
  filter: ReviewListFilter,
  closed: boolean,
) {
  const options = reviewListOptions(entries);
  const rows = filterReviewList(entries, query, filter, closed);
  return {
    rows,
    filters: [
      {
        key: 'projects' as const,
        label: 'Projects',
        items: reviewListFilterItems(options.projects, filter.projects),
      },
      {
        key: 'environments' as const,
        label: 'Environments',
        items: reviewListFilterItems(options.environments, filter.environments),
      },
    ],
  };
}

export function pullRequestStateLabel(pull: {
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
}) {
  if (pull.state === 'open' && pull.draft) return 'Draft';
  return { open: 'Open', closed: 'Closed', merged: 'Merged' }[pull.state];
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
