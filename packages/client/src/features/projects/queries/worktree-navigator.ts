import { Cause, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readGitStatus } from '../../changes/queries/changes.ts';
import {
  readProjectReviews,
  readReviewPullChecks,
  readReview,
} from '../../reviews/queries/project-reviews.ts';
import { readPublishedReview } from '../../reviews/queries/publication.ts';
import { checkoutFolder } from '../../reviews/rules/review-list.ts';
import { pullRequestNumber } from '../../reviews/rules/pull-request.ts';
import type { ReviewRecord } from '../../reviews/rules/review.ts';
import {
  navigatorEntryMatches,
  navigatorProjectVisible,
  reconcileNavigatorStatusNotices,
  navigatorFilterSections,
  navigatorWorktreeOrder,
  type NavigatorEntry,
  type NavigatorReview,
} from '../rules/worktree-navigator.ts';
import { worktreeLabel, type Project } from '../rules/inventory.ts';
import { reviewInbox } from '../rules/review-inbox.ts';
import {
  worktreeNavigatorState,
  worktreeStatusNotices,
} from '../store/worktree-navigator.ts';
import { readInventory } from './inventory.ts';
import {
  environmentIcon,
  type EnvironmentIcon,
} from '../../access/rules/environment-icon.ts';

type StatusFailure = {
  entry: NavigatorEntry;
  detail: string | undefined;
};

type NavigatorProject = {
  key: string;
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  environmentIcon: EnvironmentIcon;
  expanded: boolean;
  entries: readonly NavigatorEntry[];
};
type ProjectInput = {
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
};
function recordReview(
  record: ReviewRecord,
): Extract<NavigatorReview, { state: 'available' }> {
  return {
    state: 'available',
    reviewId: record.reviewId,
    closed: record.state === 'closed' || record.archived === true,
    archived: record.archived === true,
    pullRequestNumber: record.pullRequest
      ? pullRequestNumber(record.pullRequest)
      : undefined,
    timing: record.timing ?? 'decision',
    latestRevision: record.latestRevision,
    lastSeenRevision: record.lastSeenRevision,
  };
}
function inventoryEntries(input: ProjectInput): NavigatorEntry[] {
  const { project, connection, environmentName } = input;
  return project.worktrees
    .map((worktree): NavigatorEntry => ({
      key: `${connection.environmentId}/${project.id}/${worktree.id}`,
      kind: 'worktree',
      environmentId: connection.environmentId,
      environmentName,
      projectId: project.id,
      projectName: project.name,
      worktreeId: worktree.id,
      path: worktree.path,
      name: worktree.branch ?? checkoutFolder(worktree.path).name,
      branch: worktreeLabel(worktree.branch),
      main: worktree.main,
      ...(worktree.headCommittedAt
        ? { headCommittedAt: worktree.headCommittedAt }
        : {}),
      detached: !worktree.branch,
      available: project.available && worktree.available,
      review: { state: 'loading' },
      changes: {
        state:
          project.available && worktree.available ? 'loading' : 'unavailable',
      },
    }))
    .sort(navigatorWorktreeOrder);
}
const readWorktreeReviewEntries = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    Atom.readable((get) => {
      const inventoryResult = get(readInventory(input.connection));
      const inventory = Option.getOrUndefined(
        AsyncResult.value(inventoryResult),
      );
      const savedProject = inventory?.projects.find(
        (project) => project.id === input.projectId,
      );
      if (!inventory || !savedProject) return { entries: [], messages: [] };
      const project: Project = AsyncResult.isFailure(inventoryResult)
        ? { ...savedProject, available: false }
        : savedProject;
      const environmentName = inventory.environment.name;
      const entries = inventoryEntries({ ...input, project, environmentName });
      const recordsResult = get(
        readProjectReviews({
          connection: input.connection,
          projectId: project.id,
        }),
      );
      const records = Option.getOrUndefined(AsyncResult.value(recordsResult));
      const messages: string[] = [];
      const active = (records ?? []).filter(
        (record) => record.state === 'open' && !record.archived,
      );
      const branches = new Set(entries.map((entry) => entry.branch));
      const candidates = active
        .filter((record) => branches.has(record.branch))
        .map((record) => {
          const result = get(
            readReview({
              connection: input.connection,
              reviewId: record.reviewId,
            }),
          );
          return {
            record,
            result,
            revision: Option.getOrUndefined(AsyncResult.value(result))
              ?.revision,
          };
        })
        .sort(
          (a, b) =>
            (b.revision?.publishedAt ?? '').localeCompare(
              a.revision?.publishedAt ?? '',
            ) || a.record.reviewId.localeCompare(b.record.reviewId),
        );
      if (AsyncResult.isFailure(recordsResult))
        messages.push(`Reviews for ${project.name} could not be read.`);
      const byCheckout = new Map<string, (typeof candidates)[number]>();
      const pending = new Set<string>();
      const failed = new Set<string>();
      for (const candidate of candidates) {
        if (AsyncResult.isInitial(candidate.result))
          pending.add(candidate.record.branch);
        if (AsyncResult.isFailure(candidate.result) || !candidate.revision)
          failed.add(candidate.record.branch);
        const revision = candidate.revision;
        if (!revision || revision.projectId !== project.id) continue;
        const key = JSON.stringify([
          revision.worktreePath,
          revision.content.worktreeId,
        ]);
        if (!byCheckout.has(key)) byCheckout.set(key, candidate);
      }
      for (const entry of entries) {
        if (AsyncResult.isFailure(recordsResult)) {
          entry.review = { state: 'unavailable' };
          continue;
        }
        if (!records) continue;
        const match = byCheckout.get(
          JSON.stringify([entry.path, entry.worktreeId]),
        );
        if (!match || match.record.branch !== entry.branch) {
          if (failed.has(entry.branch) && !pending.has(entry.branch))
            messages.push(
              `Review for ${entry.name} on ${environmentName} could not be read.`,
            );
          entry.review = { state: 'none' };
          if (failed.has(entry.branch)) entry.review = { state: 'unavailable' };
          if (pending.has(entry.branch)) entry.review = { state: 'loading' };
          continue;
        }
        entry.review = recordReview(match.record);
      }
      return { entries, messages };
    }).pipe(Atom.setIdleTTL(0)),
);

const readStoredReviewEntries = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    older: boolean;
  }) =>
    Atom.readable((get) => {
      const inventoryResult = get(readInventory(input.connection));
      const inventory = Option.getOrUndefined(
        AsyncResult.value(inventoryResult),
      );
      const project = inventory?.projects.find(
        (project) => project.id === input.projectId,
      );
      const statusFailures: StatusFailure[] = [];
      if (!inventory || !project)
        return { entries: [], messages: [], loading: false, statusFailures };
      const result = get(
        readProjectReviews({
          connection: input.connection,
          projectId: input.projectId,
        }),
      );
      const records = Option.getOrUndefined(AsyncResult.value(result)) ?? [];
      const checkouts =
        !AsyncResult.isFailure(inventoryResult) && project.available
          ? project.worktrees
              .filter(
                (worktree) =>
                  worktree.available &&
                  records.some(
                    (record) =>
                      record.state === 'open' &&
                      !record.archived &&
                      record.branch === worktreeLabel(worktree.branch),
                  ),
              )
              .map((worktree) => {
                const published = get(
                  readPublishedReview({
                    connection: input.connection,
                    scope: { projectId: project.id, worktreeId: worktree.id },
                  }),
                );
                return {
                  worktree,
                  pending: AsyncResult.isInitial(published),
                  reviewId: AsyncResult.isSuccess(published)
                    ? published.value?.reviewId
                    : undefined,
                };
              })
          : [];
      const entries = records
        .filter(
          (record) =>
            input.older || (record.state === 'open' && !record.archived),
        )
        .filter(
          (record) =>
            record.state !== 'open' ||
            record.archived ||
            !checkouts.some(
              (entry) =>
                entry.pending &&
                worktreeLabel(entry.worktree.branch) === record.branch,
            ),
        )
        .map((record): NavigatorEntry => {
          const checkout = checkouts.find(
            (entry) =>
              entry.reviewId === record.reviewId &&
              worktreeLabel(entry.worktree.branch) === record.branch,
          )?.worktree;
          return {
            key: `${input.connection.environmentId}/${record.reviewId}`,
            kind: 'review',
            environmentId: input.connection.environmentId,
            environmentName: inventory.environment.name,
            projectId: project.id,
            projectName: project.name,
            worktreeId: checkout?.id,
            path: checkout?.path,
            name: record.branch,
            branch: record.branch,
            main: false,
            detached: record.branch === 'Detached HEAD',
            available: true,
            review: { ...recordReview(record), retained: true },
            changes: { state: 'unavailable' },
          };
        });
      return {
        entries,
        messages: AsyncResult.isFailure(result)
          ? [`Reviews for ${project.name} could not be read.`]
          : [],
        loading:
          AsyncResult.isInitial(result) ||
          checkouts.some((entry) => entry.pending),
        statusFailures,
      };
    }).pipe(Atom.setIdleTTL(0)),
);

const readNavigatorProject = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    Atom.readable((get) => {
      const reviewed = get(readWorktreeReviewEntries(input));
      const statusFailures: StatusFailure[] = [];
      const entries = reviewed.entries.map((source) => {
        const entry: NavigatorEntry = { ...source };
        if (entry.available && entry.worktreeId) {
          const status = get(
            readGitStatus({
              connection: input.connection,
              scope: {
                projectId: entry.projectId,
                worktreeId: entry.worktreeId,
              },
            }),
          );
          const answer = Option.getOrUndefined(AsyncResult.value(status));
          if (AsyncResult.isFailure(status))
            statusFailures.push({
              entry,
              detail: Option.getOrUndefined(Cause.findErrorOption(status.cause))
                ?.message,
            });
          entry.changes = AsyncResult.isFailure(status)
            ? { state: 'unavailable' }
            : answer
              ? {
                  state: 'available',
                  count: new Set(
                    answer.changes.map((change) =>
                      change.scope === 'untracked' ||
                      change.scope === 'unmerged'
                        ? change.path
                        : (change.newPath ?? change.oldPath),
                    ),
                  ).size,
                }
              : { state: 'loading' };
        }
        return entry;
      });
      return {
        entries,
        messages: reviewed.messages,
        statusFailures,
        loading: false,
      };
    }).pipe(Atom.setIdleTTL(0)),
);
function connectionInventories(
  get: Atom.AtomContext,
  connections: readonly RuntimeConnection[],
) {
  const reads = connections.map((connection) => {
    const result = get(readInventory(connection));
    return {
      connection,
      result,
      inventory: Option.getOrUndefined(AsyncResult.value(result)),
    };
  });
  return {
    reads,
    loading: reads.some(({ result }) => AsyncResult.isInitial(result)),
    messages: reads.flatMap(({ result, inventory }) =>
      AsyncResult.isFailure(result)
        ? [
            `${inventory?.environment.name ?? 'Computer'}: projects could not be read.`,
          ]
        : [],
    ),
  };
}

function navigator(
  connections: readonly RuntimeConnection[],
  view: 'worktrees' | 'reviews' | 'inbox',
) {
  return Atom.readable((get) => {
    const state = get(worktreeNavigatorState);
    const reviewsOnly = view !== 'worktrees';
    const query = view === 'inbox' ? '' : state.query;
    const all: NavigatorProject[] = [];
    const observedEntries: NavigatorEntry[] = [];
    const readEnvironments: string[] = [];
    const statusIssues: {
      connection: RuntimeConnection;
      environmentName: string;
      failures: StatusFailure[];
    }[] = [];
    const inventories = connectionInventories(get, connections);
    const messages = [...inventories.messages];
    let detailsLoading = false;
    for (const { connection, result, inventory } of inventories.reads) {
      if (AsyncResult.isSuccess(result))
        readEnvironments.push(connection.environmentId);
      for (const savedProject of inventory?.projects ?? []) {
        const project: Project = AsyncResult.isFailure(result)
          ? { ...savedProject, available: false }
          : savedProject;
        const key = `${connection.environmentId}/${project.id}`;
        all.push({
          key,
          connection,
          project,
          environmentName: inventory!.environment.name,
          environmentIcon: environmentIcon(inventory!.environment),
          expanded:
            view === 'inbox' ||
            query.trim().length > 0 ||
            state.expanded[key] !== false,
          entries: [],
        });
      }
    }
    all.sort(
      (a, b) =>
        a.project.name.localeCompare(b.project.name) ||
        a.environmentName.localeCompare(b.environmentName) ||
        a.key.localeCompare(b.key),
    );
    const filters = navigatorFilterSections(
      all.map((source) => ({
        key: source.key,
        name: source.project.name,
        environmentId: source.connection.environmentId,
        environmentName: source.environmentName,
        environmentIcon: source.environmentIcon,
      })),
      state.filter,
    );
    const projects: NavigatorProject[] = [];
    for (const source of all) {
      if (
        !navigatorProjectVisible(
          source.key,
          source.connection.environmentId,
          state.filter,
        )
      )
        continue;
      if (!source.expanded) {
        projects.push(source);
        continue;
      }
      const input = {
        connection: source.connection,
        projectId: source.project.id,
      };
      const answer = reviewsOnly
        ? get(readStoredReviewEntries({ ...input, older: state.filter.older }))
        : get(readNavigatorProject(input));
      detailsLoading ||= answer.loading;
      observedEntries.push(...answer.entries);
      messages.push(...answer.messages);
      if (answer.statusFailures.length > 0) {
        const issue = statusIssues.find(
          (issue) =>
            issue.connection.environmentId === source.connection.environmentId,
        );
        if (issue) issue.failures.push(...answer.statusFailures);
        else
          statusIssues.push({
            connection: source.connection,
            environmentName: source.environmentName,
            failures: [...answer.statusFailures],
          });
      }
      const entries = answer.entries
        .filter((entry) => navigatorEntryMatches(entry, query, state.filter))
        .map((entry): NavigatorEntry => ({
          ...entry,
          review: { ...entry.review },
          changes: { ...entry.changes },
        }));
      for (const entry of entries) {
        if (
          entry.review.state === 'available' &&
          entry.review.pullRequestNumber
        ) {
          const result = get(
            readReviewPullChecks({
              connection: source.connection,
              reviewId: entry.review.reviewId,
            }),
          );
          const value = Option.getOrUndefined(AsyncResult.value(result));
          entry.review.checks = { state: 'loading' };
          if (
            AsyncResult.isFailure(result) ||
            (value &&
              (value.kind !== 'available' ||
                value.number !== entry.review.pullRequestNumber))
          )
            entry.review.checks = { state: 'unavailable' };
          else if (value?.kind === 'available')
            entry.review.checks = {
              state: 'available',
              result: value.checks,
            };
        }
      }
      if (
        entries.length === 0 &&
        (reviewsOnly || query.trim() || state.filter.reviews !== undefined)
      )
        continue;
      projects.push({ ...source, entries });
    }
    const previousNotices = get.once(worktreeStatusNotices);
    const notices = reconcileNavigatorStatusNotices(previousNotices, {
      issues: statusIssues.map(({ connection, environmentName, failures }) => ({
        environmentId: connection.environmentId,
        environmentName,
        failures,
      })),
      recoveredKeys: observedEntries
        .filter((entry) => entry.changes.state === 'available')
        .map((entry) => entry.key),
      inventoryKeys: all.flatMap((source) =>
        source.project.worktrees.map(
          (worktree) =>
            `${source.connection.environmentId}/${source.project.id}/${worktree.id}`,
        ),
      ),
      environments: readEnvironments,
    });
    if (notices !== previousNotices) get.set(worktreeStatusNotices, notices);
    return {
      projects,
      allProjects: all,
      statusIssues: get(worktreeStatusNotices),
      filters,
      loading: inventories.loading || detailsLoading,
      messages: [...new Set(messages)],
    };
  });
}

export const readWorktreeNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    navigator(connections, 'worktrees'),
);

export const readReviewNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    navigator(connections, 'reviews'),
);

export const readReviewInbox = Atom.family(
  (connections: readonly RuntimeConnection[]) => {
    const reviews = navigator(connections, 'inbox');
    return Atom.readable((get) => {
      const { filter } = get(worktreeNavigatorState);
      const result = get(reviews);
      return {
        inbox: reviewInbox(
          result.projects.flatMap((project) => project.entries),
          filter.older,
        ),
        filters: result.filters,
        loading: result.loading,
        messages: result.messages,
      };
    });
  },
);
