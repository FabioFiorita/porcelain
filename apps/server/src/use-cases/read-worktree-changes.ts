import type { GitChange } from '@porcelain/git/dtos/git-status';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import type { WorktreeFiles } from '../filesystem/interfaces/worktree-files.ts';
import type { ChangeList, FileChange } from '../models/change.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { fingerprintChange } from './fingerprint-change.ts';
import {
  logicalPath,
  observeWorktreeSides,
  orderComparisons,
} from './observe-worktree-sides.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ReadWorktreeChanges {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly inspection: InspectionFactory;
  private readonly files: WorktreeFiles;

  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    inspection: InspectionFactory,
    files: WorktreeFiles,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.inspection = inspection;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<ChangeList> {
    signal?.throwIfAborted();
    const { environmentId, worktree, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const reader = this.inspection(checkout);
    const observed = await reader.readStatus(signal);
    signal?.throwIfAborted();

    const byPath = new Map<string, GitChange[]>();
    for (const change of observed.changes) {
      const path = logicalPath(change);
      byPath.set(path, [...(byPath.get(path) ?? []), change]);
    }
    const { sides } = await observeWorktreeSides(
      reader,
      this.files,
      worktree.path,
      observed.changes,
      signal,
    );
    const changes: FileChange[] = [...byPath.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, comparisons]) => {
        const ordered = orderComparisons(comparisons);
        return {
          path,
          fingerprint: fingerprintChange(path, ordered, (file) =>
            sides.get(file),
          ),
          comparisons: ordered,
        };
      });
    await this.worktrees.reachable(worktreeId, signal);
    return {
      environmentId,
      worktreeId,
      statusToken: observed.statusToken,
      headOid: observed.headOid,
      inProgress: observed.inProgress ?? null,
      mergeHeadOid: observed.mergeHeadOid ?? null,
      branch: observed.branch
        ? {
            name: observed.branch.name,
            upstream: observed.branch.upstream,
            ahead: observed.branch.ahead,
            behind: observed.branch.behind,
          }
        : null,
      changes,
    };
  }

  async fingerprints(
    worktreeId: string,
    paths: readonly string[],
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    signal?.throwIfAborted();
    const { worktree, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const reader = this.inspection(checkout);
    const observed = await reader.readStatus(signal);
    const wanted = new Set(paths);
    const selected = observed.changes.filter((change) =>
      wanted.has(logicalPath(change)),
    );
    const { sides } = await observeWorktreeSides(
      reader,
      this.files,
      worktree.path,
      selected,
      signal,
    );
    const byPath = new Map<string, GitChange[]>();
    for (const change of selected) {
      const path = logicalPath(change);
      byPath.set(path, [...(byPath.get(path) ?? []), change]);
    }
    await this.worktrees.reachable(worktreeId, signal);
    return new Map(
      [...byPath].flatMap(([path, comparisons]) => {
        const fingerprint = fingerprintChange(
          path,
          orderComparisons(comparisons),
          (file) => sides.get(file),
        );
        return fingerprint ? [[path, fingerprint] as const] : [];
      }),
    );
  }
}
