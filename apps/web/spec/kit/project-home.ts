import { hostCommands } from './commands';

export const projectHome = {
  repository: (name: string) =>
    hostCommands.porcelainProjectHome({ kind: 'repository', name }),
  folder: (name: string) =>
    hostCommands.porcelainProjectHome({ kind: 'folder', name }),
};
