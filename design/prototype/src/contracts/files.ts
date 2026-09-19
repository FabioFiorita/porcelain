/**
 * Mirror of packages/contracts/src/files.ts, with the section 7 changes. Reads cost
 * no Git: the worktree's identity is one stat of its Git folder, and path safety
 * refuses symlinks out of the worktree and files that change mid-read. Folders load
 * when opened; quick open searches with one `git ls-files`.
 */

export type DirectoryEntry = {
  name: string;
  kind: 'file' | 'directory' | 'symlink' | 'submodule';
  /** PROPOSED: matched by .gitignore. Shown dimmed; an ignored folder lists only when opened. */
  ignored: boolean;
  /** PROPOSED: a symlink's target as written. Symlinks and submodules are never followed. */
  target?: string;
};

/** GET /worktrees/:worktreeId/directory?path= (the root is ""). One directory read plus one `git check-ignore`. */
export type DirectoryListing = {
  worktreeId: string;
  path: string;
  entries: DirectoryEntry[];
};

/** PROPOSED: quick open. GET /worktrees/:worktreeId/files/search?query= */
export type FileSearchResponse = {
  worktreeId: string;
  query: string;
  /** Tracked and untracked files, not ignored ones, best matches first. */
  paths: string[];
  truncated: boolean;
};

export type TextResponse = {
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
  /** PROPOSED: sent back with a save, so an edit never overwrites a newer file. */
  fingerprint: string;
};

/**
 * PROPOSED: a file's own signed link, for what the app shows as the file itself: an
 * image, or an HTML page (images, CSS and scripts beside it load from the same link
 * prefix). Every response carries the summary's sandbox header and `nosniff`: an SVG
 * or a file served as the wrong type would otherwise run in the server's origin. `revision` reads it at a commit, as a
 * changed image's Before. GET /worktrees/:worktreeId/preview-link?path=&revision=
 */
export type PreviewLinkResponse = { url: string };

/** PROPOSED: save an edit. Rejected with `FILE_CHANGED` if the file changed on disk since it was opened. */
export type WriteFileRequest = {
  path: string;
  text: string;
  expectedFingerprint: string;
};

/** PROPOSED: a folder path ends with `/`. */
export type CreateEntryRequest = { path: string; kind: 'file' | 'directory' };

/** PROPOSED: rename or move a file or folder. */
export type MoveEntryRequest = { from: string; to: string };

/** PROPOSED: moves to the system trash, so it can be recovered; never unlinks. */
export type RemoveEntryRequest = { path: string };

/** PROPOSED: what a write, create, move or delete touched; the live channel announces the same paths. */
export type FileEditResponse = { worktreeId: string; changed: string[] };
