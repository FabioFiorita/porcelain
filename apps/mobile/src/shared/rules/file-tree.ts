import type { ListDirectoryResponse } from '@porcelain/contracts/files';
import type { FileTreeNode } from './file-tree-model';
import { isImagePath } from '@porcelain/client/files/rules';

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
              : isImagePath(path)
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
    htm: 'html',
    css: 'css',
    md: 'markdown',
    mdx: 'markdown',
    sh: 'bash',
    bash: 'bash',
  };
  return languages[extension];
}
