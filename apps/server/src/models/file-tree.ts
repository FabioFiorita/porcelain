export type FileTreeEntry = {
  path: string;
  kind: 'file' | 'directory' | 'symlink' | 'submodule' | 'other';
  ignored: boolean;
  target?: string;
};
export type FileTree = { worktreeId: string; entries: FileTreeEntry[] };
