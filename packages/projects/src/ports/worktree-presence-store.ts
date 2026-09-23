export interface WorktreePresenceStore {
  record(projectId: string, presentIds: string[]): void;
  observe(projectId: string, presentIds: string[], at: string): void;
  expired(before: string): string[];
  collect(worktreeIds: string[]): void;
}
