import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readGitStatus } from '../../changes/queries/changes.ts';
import {
  readProjectReviews,
  readReview,
  readReviewMarks,
} from '../../reviews/queries/project-reviews.ts';
import {
  decisionMarked,
  checkoutFolder,
} from '../../reviews/rules/review-list.ts';
import { pullRequestNumber } from '../../reviews/rules/pull-request.ts';
import type { ReviewRecord } from '../../reviews/rules/review.ts';
import {
  navigatorEntryMatches,
  navigatorFilterSections,
  type NavigatorEntry,
  type NavigatorReview,
} from '../rules/worktree-navigator.ts';
import { worktreeLabel, type Project } from '../rules/inventory.ts';
import { worktreeNavigatorState } from '../store/worktree-navigator.ts';
import { readInventory } from './inventory.ts';

type NavigatorProject = {
  key: string;
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  expanded: boolean;
  entries: readonly NavigatorEntry[];
};
type ProjectInput = {
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  older: boolean;
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
    progress: undefined,
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
      detached: !worktree.branch,
      available: project.available && worktree.available,
      review: { state: 'loading' },
      changes: {
        state:
          project.available && worktree.available ? 'loading' : 'unavailable',
      },
    }))
    .sort(
      (a, b) =>
        Number(b.main) - Number(a.main) ||
        a.name.localeCompare(b.name) ||
        a.key.localeCompare(b.key),
    );
}
const readNavigatorProject = Atom.family((input: ProjectInput) =>
  Atom.readable((get) => {
    const entries = inventoryEntries(input);
    const recordsResult = get(
      readProjectReviews({
        connection: input.connection,
        projectId: input.project.id,
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
          revision: Option.getOrUndefined(AsyncResult.value(result))?.revision,
        };
      })
      .sort(
        (a, b) =>
          (b.revision?.publishedAt ?? '').localeCompare(
            a.revision?.publishedAt ?? '',
          ) || a.record.reviewId.localeCompare(b.record.reviewId),
      );
    if (AsyncResult.isFailure(recordsResult))
      messages.push(`Reviews for ${input.project.name} could not be read.`);
    const byCheckout = new Map<string, (typeof candidates)[number]>();
    const pending = new Set<string>();
    const failed = new Set<string>();
    for (const candidate of candidates) {
      if (AsyncResult.isInitial(candidate.result))
        pending.add(candidate.record.branch);
      if (AsyncResult.isFailure(candidate.result) || !candidate.revision)
        failed.add(candidate.record.branch);
      const revision = candidate.revision;
      if (!revision || revision.projectId !== input.project.id) continue;
      const key = JSON.stringify([
        revision.worktreePath,
        revision.content.worktreeId,
      ]);
      if (!byCheckout.has(key)) byCheckout.set(key, candidate);
    }
    const associated = new Set<string>();
    for (const entry of entries) {
      if (entry.available && entry.worktreeId) {
        const status = get(
          readGitStatus({
            connection: input.connection,
            scope: { projectId: entry.projectId, worktreeId: entry.worktreeId },
          }),
        );
        const answer = Option.getOrUndefined(AsyncResult.value(status));
        if (AsyncResult.isFailure(status))
          messages.push(
            `Working tree status for ${entry.name} on ${input.environmentName} could not be read.`,
          );
        entry.changes = AsyncResult.isFailure(status)
          ? { state: 'unavailable' }
          : answer
            ? {
                state: 'available',
                count: new Set(
                  answer.changes.map((change) =>
                    change.scope === 'untracked' || change.scope === 'unmerged'
                      ? change.path
                      : (change.newPath ?? change.oldPath),
                  ),
                ).size,
              }
            : { state: 'loading' };
      }
      if (AsyncResult.isFailure(recordsResult)) {
        entry.review = { state: 'unavailable' };
        continue;
      }
      if (!records) continue;
      const match = byCheckout.get(
        JSON.stringify([entry.path, entry.worktreeId]),
      );
      if (!match) {
        if (failed.has(entry.branch) && !pending.has(entry.branch))
          messages.push(
            `Review for ${entry.name} on ${input.environmentName} could not be read.`,
          );
        entry.review = { state: 'none' };
        if (failed.has(entry.branch)) entry.review = { state: 'unavailable' };
        if (pending.has(entry.branch)) entry.review = { state: 'loading' };
        continue;
      }
      associated.add(match.record.reviewId);
      const markResult = get(
        readReviewMarks({
          connection: input.connection,
          reviewId: match.record.reviewId,
        }),
      );
      const marks = Option.getOrUndefined(AsyncResult.value(markResult));
      if (AsyncResult.isFailure(markResult))
        messages.push(
          `Progress for ${entry.name} on ${input.environmentName} could not be read.`,
        );
      const layers = match.revision?.content.layers;
      entry.review = {
        ...recordReview(match.record),
        ...(marks && layers && !AsyncResult.isFailure(markResult)
          ? {
              progress: {
                reviewed: layers.filter((layer) =>
                  decisionMarked(marks.decisions, layer),
                ).length,
                total: layers.length,
              },
            }
          : {}),
        progressUnavailable: AsyncResult.isFailure(markResult),
      };
    }
    if (input.older) {
      for (const record of records ?? []) {
        if (associated.has(record.reviewId)) continue;
        const revision = candidates.find(
          (candidate) => candidate.record.reviewId === record.reviewId,
        )?.revision;
        entries.push({
          key: `${input.connection.environmentId}/${record.reviewId}`,
          kind: 'review',
          environmentId: input.connection.environmentId,
          environmentName: input.environmentName,
          projectId: input.project.id,
          projectName: input.project.name,
          worktreeId: entries.find(
            (entry) => revision?.worktreePath === entry.path,
          )?.worktreeId,
          path: revision?.worktreePath,
          name: record.branch,
          branch: record.branch,
          main: false,
          detached: record.branch === 'Detached HEAD',
          available: true,
          review: { ...recordReview(record), retained: true },
          changes: { state: 'unavailable' },
        });
      }
    }
    return { entries, messages };
  }),
);
export const readWorktreeNavigator = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    Atom.readable((get) => {
      const state = get(worktreeNavigatorState);
      const all: NavigatorProject[] = [];
      const messages: string[] = [];
      let loading = false;
      for (const connection of connections) {
        const result = get(readInventory(connection));
        const inventory = Option.getOrUndefined(AsyncResult.value(result));
        if (AsyncResult.isInitial(result)) loading = true;
        if (AsyncResult.isFailure(result))
          messages.push(
            `${inventory?.environment.name ?? 'Computer'}: projects could not be read.`,
          );
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
            expanded:
              state.query.trim().length > 0 || state.expanded[key] !== false,
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
        })),
        state.filter,
      );
      const projects: NavigatorProject[] = [];
      for (const source of all) {
        if (state.filter.reviews?.length === 0) continue;
        if (
          state.filter.projects !== undefined &&
          !state.filter.projects.includes(source.key)
        )
          continue;
        if (
          state.filter.environments !== undefined &&
          !state.filter.environments.includes(source.connection.environmentId)
        )
          continue;
        if (!source.expanded) {
          projects.push(source);
          continue;
        }
        const answer = get(
          readNavigatorProject({
            connection: source.connection,
            project: source.project,
            environmentName: source.environmentName,
            older: state.filter.older,
          }),
        );
        messages.push(...answer.messages);
        const entries = answer.entries.filter((entry) =>
          navigatorEntryMatches(entry, state.query, state.filter),
        );
        if (
          entries.length === 0 &&
          (state.query.trim() || state.filter.reviews !== undefined)
        )
          continue;
        projects.push({ ...source, entries });
      }
      return {
        projects,
        allProjects: all,
        filters,
        loading,
        messages: [...new Set(messages)],
      };
    }),
);
