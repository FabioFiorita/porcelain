/**
 * Mirror of packages/contracts/src/inventory.ts, with the section 2 changes.
 * Projects are stored; worktrees are listed live from Git on every read (one
 * process per project), so there is no refresh route and nothing to rescan. A
 * worktree id is derived from the filesystem identity of its Git folder: stable
 * across restarts and moves, new for a worktree recreated at the same path.
 */

/**
 * PROPOSED: the sidebar dot, computed from SQLite with the list. No counts.
 * - `review: 'ready'`: the agent published a review that still describes uncommitted code (green).
 * - `review: 'reviewed'`: every layer is ticked, nothing committed yet (hollow green).
 * - `agentReplied`: an agent message the reviewer has not seen (yellow; wins over green).
 */
export type WorktreeSignal = {
  review: 'ready' | 'reviewed' | null;
  agentReplied: boolean;
};

export type Worktree = {
  id: string;
  path: string;
  main: boolean;
  /** `refs/heads/<name>`, or null when detached. Its name is what the navigator shows. */
  branch: string | null;
  signal: WorktreeSignal;
};

export type ProjectResponse = {
  id: string;
  /** From the repository name in the `origin` URL, else the main worktree's folder; the owner can rename it. */
  name: string;
  /** PROPOSED: where the project was registered (its main worktree), shown even when unreachable. */
  path: string;
  /** False when the repository cannot be reached; its worktrees cannot be listed then. */
  available: boolean;
  worktrees: Worktree[];
};

export type InventoryResponse = {
  environmentId: string;
  projects: ProjectResponse[];
};

export type RegisterProjectRequest = { path: string };

/** PROPOSED: PATCH /projects/:projectId */
export type RenameProjectRequest = { name: string };

/** PROPOSED: repositories the server can see, offered by the open-project dialog. */
export type DiscoveredRepository = { name: string; path: string };

/** PROPOSED: one folder on the server's disk, for the open-project folder browser. */
export type DirectoryBrowseResponse = {
  path: string;
  /** Null at the filesystem root. */
  parent: string | null;
  isRepository: boolean;
  entries: {
    name: string;
    path: string;
    isRepository: boolean;
    open: boolean;
  }[];
};
