export interface FileTarget {
  worktreeId: string;
  root: string;
  path: string;
}
export interface DirectoryListing {
  worktreeId: string;
  path: string;
  entries: {
    name: string;
    kind: 'file' | 'directory' | 'symlink' | 'submodule' | 'other';
    /** Dimmed in the tree, and never descended into to find that out. */
    ignored?: boolean;
    /** Where a link points, which is all this ever reads of one. */
    target?: string;
  }[];
}
export interface TextContent {
  contentFingerprint?: string;
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
}
