import { delimiter, dirname } from 'node:path';

const systemDirectories = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

export function serviceSearchPath(
  nodeExecutable: string,
  hostSearchPath: string,
): string {
  const directories = [
    dirname(nodeExecutable),
    ...hostSearchPath
      .split(delimiter)
      .filter(
        (directory) =>
          directory.length > 0 &&
          !directory.includes('node_modules/.bin') &&
          !directory.includes('/.npm/_npx/'),
      ),
    ...systemDirectories,
  ];
  return [...new Set(directories)].join(delimiter);
}
