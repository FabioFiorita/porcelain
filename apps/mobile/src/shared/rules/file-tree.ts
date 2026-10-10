import type { ListDirectoryResponse } from '@porcelain/contracts/files';
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
