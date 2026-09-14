import type { FileTree } from '../../models/file-tree.ts';
export interface FileTreeReader {
  read(
    root: string,
    worktreeId: string,
    listed: { paths: string[]; ignored: string[] },
    signal?: AbortSignal,
  ): Promise<FileTree>;
}

export type TreePathReader = (
  root: string,
  signal?: AbortSignal,
) => Promise<{ paths: string[]; ignored: string[] }>;
