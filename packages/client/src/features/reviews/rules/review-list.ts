import type { ReviewMarks, ReviewRecord } from './review.ts';
import type { ReviewRevision } from './verdict.ts';
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
  title: string;
  group: ReviewListGroup;
  closed: boolean;
  archivable?: boolean | undefined;
  archived?: boolean | undefined;
  reviewed: number;
  total: number;
  publishedAt?: string | undefined;
  pullRequestNumber?: string | undefined;
  badges: readonly ReviewListBadge[];
  disabled: boolean;
};

export function reviewListStatus({
  revision,
  marks,
  status,
}: {
  revision: Pick<ReviewRevision, 'content' | 'verdict'> | undefined;
  marks: ReviewMarks | undefined;
  status: ReadInventoryResponse['projects'][number]['worktrees'][number]['status'];
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
  const group: ReviewListGroup = replied
    ? 'Needs you'
    : revision?.verdict.recommendation === 'merge' && complete
      ? 'Ready to merge'
      : status === 'reviewed' || complete
        ? 'Waiting on agent'
        : 'Needs you';
  const badges: ReviewListBadge[] = [];
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

export function reviewArchivable(
  record: Pick<ReviewRecord, 'archived'>,
  pull:
    | {
        kind: string;
        pullRequest?: { state: 'open' | 'closed' | 'merged' };
      }
    | undefined,
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

export function reviewListRowContext(
  entry: ReviewListEntry,
  multipleProjects: boolean,
) {
  const noReview = entry.group === 'No review';
  return {
    project:
      noReview || (multipleProjects && entry.group !== 'Projects')
        ? entry.projectName
        : undefined,
    branch: noReview ? undefined : entry.branch,
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
    multipleProjects:
      new Set(rows.map((entry) => `${entry.environmentId}/${entry.projectId}`))
        .size > 1,
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
