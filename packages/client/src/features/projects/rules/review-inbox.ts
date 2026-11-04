import {
  emptyNavigatorFilter,
  navigatorCardReviewLabel,
  navigatorEntryMatches,
  type NavigatorEntry,
  type NavigatorReview,
} from './worktree-navigator.ts';

type AvailableReview = Extract<NavigatorReview, { state: 'available' }>;
export type ReviewInboxStatus =
  | 'needs-you'
  | 'reviewed'
  | 'reading'
  | 'unavailable';
export type ReviewInboxRow = {
  key: string;
  entry: NavigatorEntry;
  review: AvailableReview;
  status: ReviewInboxStatus;
  label: string;
};
type ReviewInboxProject = {
  key: string;
  name: string;
  environmentName: string;
  rows: readonly ReviewInboxRow[];
};
export type ReviewInbox = {
  needsYou: readonly ReviewInboxRow[];
  projects: readonly ReviewInboxProject[];
  reading: boolean;
};

function reviewInboxStatus(review: AvailableReview): ReviewInboxStatus {
  if (review.progressUnavailable) return 'unavailable';
  if (!review.progress) return 'reading';
  return review.progress.reviewed < review.progress.total
    ? 'needs-you'
    : 'reviewed';
}

export function reviewInbox(entries: readonly NavigatorEntry[]): ReviewInbox {
  const rows = entries.flatMap((entry): ReviewInboxRow[] =>
    entry.review.state === 'available' && !entry.review.closed
      ? [
          {
            key: entry.key,
            entry,
            review: entry.review,
            status: reviewInboxStatus(entry.review),
            label: navigatorCardReviewLabel(entry),
          },
        ]
      : [],
  );
  const projects = new Map<string, ReviewInboxProject>();
  for (const row of rows) {
    if (row.status === 'needs-you') continue;
    const key = `${row.entry.environmentId}/${row.entry.projectId}`;
    const project = projects.get(key);
    projects.set(key, {
      key,
      name: row.entry.projectName,
      environmentName: row.entry.environmentName,
      rows: [...(project?.rows ?? []), row],
    });
  }
  return {
    needsYou: rows.filter((row) => row.status === 'needs-you'),
    projects: [...projects.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.environmentName.localeCompare(b.environmentName) ||
        a.key.localeCompare(b.key),
    ),
    reading: entries.some((entry) => entry.review.state === 'loading'),
  };
}

export function searchReviewInbox(
  inbox: ReviewInbox,
  query: string,
): ReviewInbox {
  if (query.trim() === '') return inbox;
  const matches = (row: ReviewInboxRow) =>
    navigatorEntryMatches(row.entry, query, emptyNavigatorFilter);
  return {
    ...inbox,
    needsYou: inbox.needsYou.filter(matches),
    projects: inbox.projects.flatMap((project) => {
      const rows = project.rows.filter(matches);
      return rows.length > 0 ? [{ ...project, rows }] : [];
    }),
  };
}
