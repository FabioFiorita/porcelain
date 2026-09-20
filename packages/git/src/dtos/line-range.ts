/**
 * A range of lines to read, one-based and inclusive, as a reviewer counts.
 *
 * `at` names where it comes from. `head` is the last commit, read from Git;
 * the working file is never a stand-in for a revision.
 */
export type LineRange = {
  path: string;
  from: number;
  to: number;
  at: 'head' | 'worktree';
};
