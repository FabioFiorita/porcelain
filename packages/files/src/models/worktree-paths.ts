export type WorktreePathsRead =
  | { kind: 'paths'; paths: string[] }
  | { kind: 'too-large' };
