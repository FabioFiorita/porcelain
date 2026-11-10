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
  detached: boolean;
  available: boolean;
  pullRequest: NavigatorPullRequest;
  changes: NavigatorChanges;
};
type NavigatorOrder = Pick<
  NavigatorEntry,
  'key' | 'name' | 'main' | 'headCommittedAt'
>;
export function navigatorWorktreeOrder(a: NavigatorOrder, b: NavigatorOrder) {
  return (
    Number(b.main) - Number(a.main) ||
    Number(b.headCommittedAt !== undefined) -
      Number(a.headCommittedAt !== undefined) ||
    (b.headCommittedAt ?? '').localeCompare(a.headCommittedAt ?? '') ||
    a.name.localeCompare(b.name) ||
    a.key.localeCompare(b.key)
  );
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
  if (changes.state === 'available' && changes.count === 0) return '';
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
  return [
    entry.name,
    entry.projectName,
    entry.environmentName,
    entry.main ? 'Main worktree' : undefined,
    entry.detached ? 'Detached HEAD' : undefined,
    entry.detached ? entry.path : undefined,
    entry.kind === 'worktree'
      ? navigatorChangesLabel(entry.changes)
      : undefined,
    entry.pullRequest.state === 'available'
      ? `Pull request #${entry.pullRequest.number}`
      : undefined,
    !entry.available && entry.kind === 'worktree' ? 'Unavailable' : undefined,
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
