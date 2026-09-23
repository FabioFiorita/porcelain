export interface WorktreePresenceStore {
  record(worktreeId: string, projectId: string): void;
  observe(projectId: string, presentIds: string[], at: string): void;
  expired(before: string): string[];
  collect(worktreeIds: string[]): void;
}
