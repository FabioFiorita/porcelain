export interface FileTarget {
  worktreeId: string;
  root: string;
  path: string;
}
export interface DirectoryListing {
  worktreeId: string;
  path: string;
  entries: { name: string; kind: 'file' | 'directory' | 'symlink' | 'other' }[];
}
export interface TextContent {
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
}
