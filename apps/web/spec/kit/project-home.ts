import { hostCommands } from './commands';
import type { ServerName } from './protocol';

export function projectHomeOn(server: ServerName) {
  return {
    repository: (name: string) =>
      hostCommands.porcelainProjectHome({ kind: 'repository', name }, server),
    folder: (name: string) =>
      hostCommands.porcelainProjectHome({ kind: 'folder', name }, server),
  };
}

export const projectHome = projectHomeOn('this');
