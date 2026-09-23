import { join } from 'node:path';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type { GitChangeSelection } from '@porcelain/git/dtos/git-status';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import type {
  StampPath,
  WorktreeFiles,
} from '../filesystem/interfaces/worktree-files.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { fingerprintChange } from './fingerprint-change.ts';
import {
  logicalPath,
  observeWorktreeSides,
  orderComparisons,
} from './observe-worktree-sides.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

const MAX_SELECTIONS = 200;

export type ChangeDiff = {
  selection: GitChangeSelection;
  content: GitDiffResult;
};

export type ExpectedFile = { path: string; fingerprint: string | null };

export class ReadChangeDiffs {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly git: InspectionFactory;
  private readonly files: WorktreeFiles;
  private readonly stamp: StampPath;

  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    git: InspectionFactory,
    files: WorktreeFiles,
    stamp: StampPath,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.git = git;
    this.files = files;
    this.stamp = stamp;
  }

  async execute(
    worktreeId: string,
    expectedStatusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly GitChangeSelection[],
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<{
    environmentId: string;
    worktreeId: string;
    statusToken: string;
    diffs: ChangeDiff[];
  }> {
    signal?.throwIfAborted();
    if (selections.length === 0 || selections.length > MAX_SELECTIONS)
      throw new WorktreeChangedError();
    const { environmentId, worktree, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const git = this.git(checkout);
    const observed = await git.readStatus(signal);
    if (observed.statusToken !== expectedStatusToken)
      throw new WorktreeChangedError();
    const wanted = selections.map((selection) => {
      const change = observed.changes.find(
        (entry) =>
          (entry.scope === 'staged' || entry.scope === 'unstaged') &&
          entry.scope === selection.scope &&
          entry.oldPath === selection.oldPath &&
          entry.newPath === selection.newPath,
      );
      if (
        !change ||
        change.scope === 'untracked' ||
        change.scope === 'unmerged'
      )
        throw new WorktreeChangedError();
      return change;
    });
    const paths = wanted.map((change) => logicalPath(change));
    const stamped = await this.confirmFingerprints(
      git,
      worktree.path,
      worktree.administrativeDirectory,
      observed.changes,
      paths,
      expectedFiles,
      signal,
    );
    const contents = await git.readDiffs(wanted, signal);
    signal?.throwIfAborted();
    const after = await git.readStatus(signal);
    if (after.statusToken !== expectedStatusToken)
      throw new WorktreeChangedError();
    const restamped = await this.confirmFingerprints(
      git,
      worktree.path,
      worktree.administrativeDirectory,
      after.changes,
      paths,
      expectedFiles,
      signal,
    );
    if (restamped !== stamped) throw new WorktreeChangedError();
    await this.worktrees.reachable(worktreeId, signal);
    return {
      environmentId,
      worktreeId,
      statusToken: observed.statusToken,
      diffs: wanted.map((change, index) => {
        const content = contents[index];
        if (!content) throw new Error('Missing diff result');
        return {
          selection: {
            scope: change.scope,
            oldPath: change.oldPath,
            newPath: change.newPath,
          },
          content,
        };
      }),
    };
  }

  private async confirmFingerprints(
    git: ReturnType<InspectionFactory>,
    root: string,
    administrative: string,
    changes: Parameters<typeof observeWorktreeSides>[3],
    paths: readonly string[],
    expectedFiles: readonly ExpectedFile[],
    signal?: AbortSignal,
  ) {
    const selected = new Set(paths);
    const relevant = changes.filter((change) =>
      selected.has(logicalPath(change)),
    );
    const { sides, stamps } = await observeWorktreeSides(
      git,
      this.files,
      root,
      relevant,
      signal,
    );
    const expected = new Map(
      expectedFiles.map((file) => [file.path, file.fingerprint]),
    );
    if (expected.size !== selected.size) throw new WorktreeChangedError();
    for (const path of selected) {
      if (!expected.has(path)) throw new WorktreeChangedError();
      const comparisons = orderComparisons(
        relevant.filter((change) => logicalPath(change) === path),
      );
      const current = fingerprintChange(path, comparisons, (file) =>
        sides.get(file),
      );
      if (current !== expected.get(path)) throw new WorktreeChangedError();
    }
    return [
      ...[...stamps].sort(([left], [right]) => left.localeCompare(right)),
      ['\0index', await this.stamp(join(administrative, 'index'))],
    ]
      .map(([path, stamp]) => `${path}\u0000${stamp}`)
      .join('\u0000');
  }
}
