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

/** A layer is a handful of files; a whole worktree is not a diff read. */
const MAX_SELECTIONS = 200;

export type ChangeDiff = {
  selection: GitChangeSelection;
  content: GitDiffResult;
};

export type ExpectedFile = { path: string; fingerprint: string | null };

/**
 * The hunks of the files a reader is about to look at, in one Git process per
 * scope however many files there are.
 *
 * It is generation aware, and the observation token alone cannot make it so:
 * the token hashes what porcelain status prints, which does not include the
 * bytes of an already-modified file. Editing such a file again leaves the
 * token identical while the patch changes, so a caller presenting only the
 * token could be shown current hunks beside the fingerprint its list was read
 * at — and would not find out until the mark it then clicked was refused.
 *
 * So the caller presents the fingerprint it holds for every logical path it is
 * asking about, and those fingerprints are established again here, from this
 * status and this working tree, before any hunk is returned. The paths are
 * carried too, so a rename cannot answer a request about the old name.
 */
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
      // The token matched, so a selection that is not in this status is one
      // the caller made up rather than one that moved underneath it.
      if (
        !change ||
        change.scope === 'untracked' ||
        change.scope === 'unmerged'
      )
        throw new WorktreeChangedError();
      return change;
    });
    const paths = wanted.map((change) => logicalPath(change));
    // Refuse early, before spending a diff on content that has already moved.
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
    // And again afterwards, against a fresh observation. The check before the
    // read only says the content was right when it started: a file edited
    // while Git was reading it would answer with the newer patch under the
    // older fingerprint, which is precisely the pairing a reader must never
    // be shown. Confirming after binds the hunks to the fingerprint returned
    // with them — content that changed and changed back is the same content.
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
    // Equal content on both sides cannot see a change that was undone: a file
    // written to something else, captured by Git, and written back reads the
    // same and fingerprints the same, while the hunks describe a state nobody
    // will ever see again. The stamp moves on any write and cannot be put
    // back, so it catches exactly that.
    if (restamped !== stamped) throw new WorktreeChangedError();
    // About to leave the process: the resolver re-reads the checkout's
    // identity from the filesystem, at no Git cost.
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

  /**
   * The content these hunks are about must still be the content the caller's
   * list described. Establishing it costs no Git process: working files are
   * digested from the filesystem, and only a moved submodule pointer asks Git.
   *
   * It answers with a stamp of everything it looked at, so the caller can ask
   * the second question a digest cannot: was any of this written at all. Equal
   * content on both sides of a read says nothing about a state in the middle.
   */
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
    // The index is read by a staged diff the same way a working file is read
    // by an unstaged one, and can be written and rewritten just as quickly.
    return [
      ...[...stamps].sort(([left], [right]) => left.localeCompare(right)),
      ['\0index', await this.stamp(join(administrative, 'index'))],
    ]
      .map(([path, stamp]) => `${path}\u0000${stamp}`)
      .join('\u0000');
  }
}
