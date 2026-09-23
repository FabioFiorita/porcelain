import type { WorktreePresenceStore } from '@porcelain/projects/ports';

type Presence = { projectId: string; missingSince: string | undefined };

export class InMemoryWorktreePresenceStore implements WorktreePresenceStore {
  private readonly rows = new Map<string, Presence>();

  observe(projectId: string, presentIds: string[], at: string): void {
    for (const worktreeId of presentIds)
      this.rows.set(worktreeId, { projectId, missingSince: undefined });
    for (const [worktreeId, row] of this.rows)
      if (
        row.projectId === projectId &&
        row.missingSince === undefined &&
        !presentIds.includes(worktreeId)
      )
        this.rows.set(worktreeId, { ...row, missingSince: at });
  }

  expired(before: string): string[] {
    return [...this.rows]
      .filter(
        ([, row]) =>
          row.missingSince !== undefined && row.missingSince < before,
      )
      .map(([worktreeId]) => worktreeId);
  }

  collect(worktreeIds: string[]): void {
    for (const worktreeId of worktreeIds) this.rows.delete(worktreeId);
  }
}
