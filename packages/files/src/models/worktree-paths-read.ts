export type WorktreePathsReadInput = {
  worktreeId: string;
};

export type WorktreePathsRead =
  | { kind: 'listed'; paths: string[] }
  | { kind: 'too-large' };
