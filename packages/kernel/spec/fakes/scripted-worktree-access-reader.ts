import type {
  Worktree,
  WorktreeCheck,
  WorktreeKey,
} from '../../src/models/worktree.ts';
import type { WorktreeAccessReader } from '../../src/ports/worktree-access-reader.ts';

const missing: WorktreeCheck = { kind: 'missing' };
const unavailable: WorktreeCheck = { kind: 'unavailable' };

function found(worktree: Worktree): [string, WorktreeCheck] {
  return [worktree.id, { kind: 'found', worktree }];
}

function refused(worktreeId: string): [string, WorktreeCheck] {
  return [worktreeId, unavailable];
}

export class ScriptedWorktreeAccessReader implements WorktreeAccessReader {
  private readonly readable: ReadonlyMap<string, WorktreeCheck>;
  private readonly writable: ReadonlyMap<string, WorktreeCheck>;

  constructor(
    worktrees: {
      readOnly?: readonly Worktree[] | undefined;
      writable?: readonly Worktree[] | undefined;
      unreadable?: readonly string[] | undefined;
    } = {},
  ) {
    const readOnly = worktrees.readOnly ?? [];
    const writable = worktrees.writable ?? [];
    const unreadable = worktrees.unreadable ?? [];
    this.readable = new Map([
      ...unreadable.map(refused),
      ...[...readOnly, ...writable].map(found),
    ]);
    this.writable = new Map([
      ...unreadable.map(refused),
      ...readOnly.map((worktree) => refused(worktree.id)),
      ...writable.map(found),
    ]);
  }

  async known(input: WorktreeKey): Promise<WorktreeCheck> {
    return this.readable.get(input.worktreeId) ?? missing;
  }

  async forWriting(input: WorktreeKey): Promise<WorktreeCheck> {
    return this.writable.get(input.worktreeId) ?? missing;
  }
}
