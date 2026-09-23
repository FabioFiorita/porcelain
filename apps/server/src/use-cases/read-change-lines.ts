import type { LineRange } from '@porcelain/git/dtos/line-range';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

const MAX_LINES = 2000;

export class ReadChangeLines {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly git: InspectionFactory;
  private readonly files: FileReader;

  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    git: InspectionFactory,
    files: FileReader,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.git = git;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    range: LineRange,
    session: GitSession,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    validateFilePath(range.path, false);
    const from = Math.max(1, Math.trunc(range.from));
    const to = Math.min(Math.trunc(range.to), from + MAX_LINES - 1);
    const { environmentId, worktree, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const all =
      range.at === 'head'
        ? await this.git(checkout).readLines(
            { path: range.path, from, to },
            signal,
          )
        : (
            await this.files.read(
              { worktreeId, root: worktree.path, path: range.path },
              signal,
            )
          ).text.split('\n');
    signal?.throwIfAborted();
    await this.worktrees.reachable(worktreeId, signal);
    if (all.length > 1 && all.at(-1) === '') all.pop();
    const last = Math.min(all.length, to);
    return {
      environmentId,
      worktreeId,
      at: range.at,
      path: range.path,
      from,
      to: Math.max(from - 1, last),
      lines: last < from ? [] : all.slice(from - 1, last),
    };
  }
}
