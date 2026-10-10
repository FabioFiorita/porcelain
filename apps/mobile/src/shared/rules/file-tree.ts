import type { ListDirectoryResponse } from '@porcelain/contracts/files';
import type { FileTreeNode } from './file-tree-model';
import { isImagePath } from '@porcelain/client/files/rules';

export const isNativeImagePath = (path: string) =>
  isImagePath(path) && !/\.svg$/i.test(path);

export function directoryRequests(
  requested: readonly string[],
  directories: readonly ListDirectoryResponse[],
): string[] {
  const byPath = new Map(
    directories.map((directory) => [directory.path, directory]),
  );
  const reachable = (path: string): boolean => {
    if (!path) return true;
    const split = path.lastIndexOf('/');
    const parent = split < 0 ? '' : path.slice(0, split);
    if (!reachable(parent)) return false;
    const directory = byPath.get(parent);
    return (
      !directory ||
      directory.entries.some(
        (entry) =>
          entry.name === path.slice(split + 1) && entry.kind === 'directory',
      )
    );
  };
  return requested.filter(reachable);
}

export function directoryTree(
  directories: readonly ListDirectoryResponse[],
): FileTreeNode[] {
  const byPath = new Map(
    directories.map((directory) => [directory.path, directory]),
  );
  const children = (parent: string): FileTreeNode[] =>
    [...(byPath.get(parent)?.entries ?? [])]
      .sort(
        (a, b) =>
          Number(b.kind === 'directory') - Number(a.kind === 'directory') ||
          a.name.localeCompare(b.name),
      )
      .map((entry) => {
        const path = parent ? `${parent}/${entry.name}` : entry.name;
        return {
          id: path,
          name: entry.name,
          kind:
            entry.kind === 'directory'
              ? 'folder'
              : isNativeImagePath(path)
                ? 'image'
                : 'file',
          ...(entry.kind === 'directory' ? { children: children(path) } : {}),
          ...(entry.kind === 'symlink'
            ? { status: 'Symlink' }
            : entry.kind === 'submodule'
              ? { status: 'Submodule' }
              : entry.kind === 'other'
                ? { status: 'Unsupported' }
                : entry.ignored
                  ? { status: 'Ignored' }
                  : {}),
        };
      });
  return children('');
}

export function sourceLanguage(path: string): string | undefined {
  const extension = path.toLowerCase().split('.').at(-1) ?? '';
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
    swift: 'swift',
    kt: 'kotlin',
    rs: 'rust',
    go: 'go',
    html: 'html',
    svg: 'xml',
    htm: 'html',
    css: 'css',
    md: 'markdown',
    mdx: 'markdown',
    sh: 'bash',
    bash: 'bash',
  };
  return languages[extension];
}
