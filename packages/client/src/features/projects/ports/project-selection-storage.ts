export type ProjectSelectionSnapshot = {
  currentEnvironmentId: string | undefined;
  selections: Record<string, { projectId: string; worktreeId: string }>;
};

export type ProjectSelectionStorage = {
  read: () => Promise<ProjectSelectionSnapshot>;
  write: (snapshot: ProjectSelectionSnapshot) => Promise<void>;
};
