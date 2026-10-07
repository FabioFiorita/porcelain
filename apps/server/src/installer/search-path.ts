import type { Path } from 'effect';

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
  pathApi: Path.Path,
): string {
  const directories = [
    pathApi.dirname(nodeExecutable),
    ...hostSearchPath
      .split(':')
      .filter(
        (directory) =>
          directory.length > 0 &&
          !directory.includes('node_modules/.bin') &&
          !directory.includes('/.npm/_npx/'),
      ),
    ...systemDirectories,
  ];
  return [...new Set(directories)].join(':');
}
