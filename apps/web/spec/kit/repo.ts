import { hostCommands } from './commands';

export async function sampleRepository() {
  const fixture = await hostCommands.porcelainFixture();
  return {
    ...fixture,
    write: (path: string, text: string) =>
      hostCommands.porcelainRepo({ kind: 'write', path, text }),
    remove: (path: string) =>
      hostCommands.porcelainRepo({ kind: 'remove', path }),
    read: (path: string) => hostCommands.porcelainRepo({ kind: 'read', path }),
    commit: (message: string) =>
      hostCommands.porcelainRepo({ kind: 'commit', message }),
    branch: (name: string) =>
      hostCommands.porcelainRepo({ kind: 'branch', name }),
    switch: (name: string) =>
      hostCommands.porcelainRepo({ kind: 'switch', name }),
  };
}
