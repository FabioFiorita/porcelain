/**
 * PROPOSED in full (server review, sections 7 and 11). Each app keeps one WebSocket
 * open to each server. The server sends notices of what changed, never the data;
 * the app reloads only that piece with the small reads. Nothing polls: no
 * refetch on window focus, no refresh calls. A heartbeat runs about every 30 s;
 * after a reconnect the app re-checks what is on screen once, and unchanged reads
 * answer "not modified".
 *
 * The server notices database writes when it makes them, and watches the worktrees
 * an app has open (ignored folders skipped) plus each project's Git folder (HEAD,
 * index, refs, the worktree list). Bursts are grouped over about 150 ms.
 */
export type LiveNotice =
  /** Projects or their worktrees changed (added, removed, renamed, a new agent worktree). */
  | { kind: 'inventory' }
  /** Files changed in a worktree (an agent edit, a save, a checkout). */
  | { kind: 'files'; worktreeId: string; paths: string[] }
  /** HEAD, the index or refs moved: a commit, pull, rebase, stash, branch switch. */
  | { kind: 'branch'; worktreeId: string }
  | { kind: 'review'; worktreeId: string; revision: number | null }
  | { kind: 'comments'; worktreeId: string; threadId: string }
  | { kind: 'marks'; worktreeId: string }
  | {
      kind: 'action';
      worktreeId: string;
      requestId: string;
      state: 'running' | 'finished';
      /** A progress line for fetch, pull and push. */
      line?: string;
    };

export type LiveState = 'connected' | 'reconnecting';
