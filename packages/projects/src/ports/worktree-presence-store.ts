export interface WorktreePresenceStore {
  observe(projectId: string, presentIds: string[], at: string): void;
  expired(before: string): string[];
  collect(worktreeIds: string[]): void;
}
