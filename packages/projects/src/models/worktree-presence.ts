export type WorktreePresence = {
  worktreeId: string;
  projectId: string;
  missingSince: string | undefined;
  preserved?: true;
};

export type SaveWorktreePresenceInput = { rows: WorktreePresence[] };

export type RemoveWorktreePresenceInput = { worktreeIds: string[] };
