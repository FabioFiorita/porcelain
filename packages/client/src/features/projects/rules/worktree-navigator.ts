import type { EnvironmentIcon } from '@porcelain/contracts/access';
export type NavigatorFilter = {
  projects: readonly string[] | undefined;
  environments: readonly string[] | undefined;
};
export const emptyNavigatorFilter: NavigatorFilter = {
  projects: undefined,
  environments: undefined,
};
export function navigatorProjectVisible(
  key: string,
  environmentId: string,
  filter: NavigatorFilter,
) {
  return (
    (filter.projects === undefined || filter.projects.includes(key)) &&
    (filter.environments === undefined ||
      filter.environments.includes(environmentId))
  );
}
export type NavigatorFilterSection = {
  key: 'projects' | 'environments';
  label: string;
  items: readonly {
    id: string;
    label: string;
    icon?: EnvironmentIcon;
    checked: boolean;
    next: readonly string[];
  }[];
};
export type NavigatorPullRequest =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'none' }
  | {
      state: 'available';
      number: number;
      merged: boolean;
      checks?:
        | { state: 'loading' }
        | { state: 'unavailable' }
        | {
            state: 'available';
            result: 'passed' | 'running' | 'failed' | 'none';
          };
    };
export type NavigatorChanges =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | {
      state: 'available';
      count: number;
    };
export type NavigatorEntry = {
  key: string;
  kind: 'worktree';
  environmentId: string;
  environmentName: string;
  projectId: string;
  projectName: string;
  worktreeId: string | undefined;
  path: string | undefined;
  name: string;
  displayTitle?: string | undefined;
  branch: string;
  main: boolean;
  headCommittedAt?: string;
  uncommittedChangedAt?: string;
  detached: boolean;
  available: boolean;
  pullRequest: NavigatorPullRequest;
  changes: NavigatorChanges;
};
type NavigatorOrder = Pick<
  NavigatorEntry,
  'key' | 'name' | 'main' | 'headCommittedAt' | 'uncommittedChangedAt'
>;
function touchedAt(entry: NavigatorOrder) {
  const times = [entry.headCommittedAt, entry.uncommittedChangedAt].filter(
    (time) => time !== undefined,
  );
  return times.length === 0 ? undefined : times.sort().at(-1);
}
export function navigatorWorktreeOrder(a: NavigatorOrder, b: NavigatorOrder) {
  const aTouched = touchedAt(a);
  const bTouched = touchedAt(b);
  return (
    Number(b.main) - Number(a.main) ||
    Number(bTouched !== undefined) - Number(aTouched !== undefined) ||
    (bTouched ?? '').localeCompare(aTouched ?? '') ||
    a.name.localeCompare(b.name) ||
    a.key.localeCompare(b.key)
  );
}
export const NAVIGATOR_RECENT_ROWS = 5;
export function navigatorVisibleRows<
  Row extends { key: string; main: boolean },
>(
  rows: readonly Row[],
  options: { selectedKey: string | undefined; showAll: boolean },
) {
  const recent = new Set(
    rows
      .filter((row) => !row.main)
      .slice(0, NAVIGATOR_RECENT_ROWS)
      .map((row) => row.key),
  );
  const collapsed = rows.filter(
    (row) => row.main || recent.has(row.key) || row.key === options.selectedKey,
  );
  const extra = rows.length - collapsed.length;
  return options.showAll
    ? { rows, more: 0, less: extra > 0 }
    : { rows: collapsed, more: extra, less: false };
}
export function navigatorDisplayTitle(worktree: {
  branch?: string | undefined;
  walkthroughTitle?: string | undefined;
  pullRequestTitle?: string | undefined;
}) {
  const title = worktree.walkthroughTitle || worktree.pullRequestTitle;
  return title && title !== worktree.branch ? title : undefined;
}
export function navigatorRowTitle(
  entry: Pick<NavigatorEntry, 'displayTitle' | 'name'>,
) {
  return entry.displayTitle ?? entry.name;
}
export type NavigatorTrailing =
  | { kind: 'pull-request'; number: number; text: string }
  | { kind: 'changes'; text: string };
export function navigatorRowTrailing(
  entry: Pick<NavigatorEntry, 'pullRequest' | 'changes'>,
): NavigatorTrailing | undefined {
  if (entry.pullRequest.state === 'available')
    return {
      kind: 'pull-request',
      number: entry.pullRequest.number,
      text: `#${entry.pullRequest.number}${entry.pullRequest.merged ? ' merged' : ''}`,
    };
  if (entry.changes.state === 'available' && entry.changes.count > 0)
    return {
      kind: 'changes',
      text: `${entry.changes.count} ${entry.changes.count === 1 ? 'file' : 'files'}`,
    };
  return undefined;
}
export function navigatorChangesLabel(changes: NavigatorChanges) {
  if (changes.state === 'loading') return 'Reading changes…';
  if (changes.state === 'unavailable') return 'Changes unavailable';
  return changes.count === 0
    ? 'Working tree clean'
    : `${changes.count} ${changes.count === 1 ? 'file' : 'files'} changed`;
}
export function navigatorCardChangesLabel(changes: NavigatorChanges) {
  if (changes.state === 'unavailable') return '—';
  if (changes.state === 'available')
    return changes.count === 0 ? '' : `${changes.count} uncommitted`;
  return navigatorChangesLabel(changes);
}
export function navigatorChecksLabel(
  checks: Extract<NavigatorPullRequest, { state: 'available' }>['checks'],
) {
  if (!checks) return 'Checks loading';
  if (checks.state !== 'available')
    return checks.state === 'loading' ? 'Checks loading' : 'Checks unavailable';
  const labels = {
    passed: 'Checks passed',
    running: 'Checks running',
    failed: 'Checks failed',
    none: 'No checks',
  };
  return labels[checks.result];
}
export function navigatorEntryLabel(entry: NavigatorEntry) {
  const title = navigatorRowTitle(entry);
  return [
    title,
    entry.branch !== title ? entry.branch : undefined,
    entry.projectName,
    entry.environmentName,
    entry.main ? 'Main worktree' : undefined,
    entry.detached ? entry.path : undefined,
    entry.changes.state === 'available' && entry.changes.count > 0
      ? `${entry.changes.count} uncommitted ${entry.changes.count === 1 ? 'file' : 'files'}`
      : undefined,
    entry.pullRequest.state === 'available'
      ? `Pull request #${entry.pullRequest.number}${entry.pullRequest.merged ? ' merged' : ''}`
      : undefined,
    !entry.available ? 'Unavailable' : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}
export function navigatorEntrySelected(
  entry: NavigatorEntry,
  selection:
    | { kind: 'worktree'; environmentId: string; worktreeId: string }
    | undefined,
) {
  if (!selection || entry.environmentId !== selection.environmentId)
    return false;
  return entry.worktreeId === selection.worktreeId;
}
export function navigatorEntryMatches(entry: NavigatorEntry, query: string) {
  const text = [
    entry.name,
    entry.displayTitle ?? '',
    entry.branch,
    entry.path,
    entry.projectName,
    entry.environmentName,
    entry.pullRequest.state === 'available'
      ? entry.pullRequest.number
      : undefined,
  ]
    .filter((value) => value !== undefined)
    .join(' ')
    .toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => text.includes(term));
}
export function navigatorFilterSections(
  projects: readonly {
    key: string;
    name: string;
    environmentId: string;
    environmentName: string;
    environmentIcon: EnvironmentIcon;
  }[],
  filter: NavigatorFilter,
): NavigatorFilterSection[] {
  const sections = [
    {
      key: 'environments' as const,
      label: 'Environments',
      options: [
        ...new Map(
          projects.map((source) => [
            source.environmentId,
            {
              id: source.environmentId,
              label: source.environmentName,
              icon: source.environmentIcon,
            },
          ]),
        ).values(),
      ],
    },
    {
      key: 'projects' as const,
      label: 'Projects',
      options: projects.map((source) => ({
        id: source.key,
        label: `${source.name} · ${source.environmentName}`,
      })),
    },
  ];
  return sections.map(({ key, label, options }) => {
    const selected = filter[key] ?? options.map((option) => option.id);
    return {
      key,
      label,
      items: options.map((option) => ({
        ...option,
        checked: selected.includes(option.id),
        next: selected.includes(option.id)
          ? selected.filter((value) => value !== option.id)
          : [...selected, option.id],
      })),
    };
  });
}

export type NavigatorStatusNotice = {
  environmentId: string;
  environmentName: string;
  dismissed: boolean;
  failures: readonly { entry: NavigatorEntry; detail: string | undefined }[];
};

export function reconcileNavigatorStatusNotices(
  previous: readonly NavigatorStatusNotice[],
  observation: {
    issues: readonly Omit<NavigatorStatusNotice, 'dismissed'>[];
    recoveredKeys: readonly string[];
    inventoryKeys: readonly string[];
    environments: readonly string[];
  },
): readonly NavigatorStatusNotice[] {
  const notices = new Map(
    previous.map((notice) => [
      notice.environmentId,
      {
        ...notice,
        failures: notice.failures.filter(
          ({ entry }) =>
            !observation.recoveredKeys.includes(entry.key) &&
            (!observation.environments.includes(entry.environmentId) ||
              observation.inventoryKeys.includes(entry.key)),
        ),
      },
    ]),
  );
  for (const issue of observation.issues) {
    const existing = notices.get(issue.environmentId);
    const failures = new Map(
      (existing?.failures ?? []).map((failure) => [failure.entry.key, failure]),
    );
    for (const failure of issue.failures)
      failures.set(failure.entry.key, failure);
    notices.set(issue.environmentId, {
      ...issue,
      dismissed: existing?.dismissed ?? false,
      failures: [...failures.values()],
    });
  }
  const next = [...notices.values()].filter(
    (notice) => notice.failures.length > 0,
  );
  return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
}
