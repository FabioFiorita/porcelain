import { hostCommands } from './commands';
import type { RepoStep, ServerName } from './protocol';

export async function sampleRepository(server: ServerName) {
  const step = (repoStep: RepoStep) =>
    hostCommands.porcelainRepo(repoStep, server);
  const { branch: initialBranch, ...fixture } =
    await hostCommands.porcelainFixture(server);
  return {
    ...fixture,
    initialBranch,
    write: (path: string, text: string) => step({ kind: 'write', path, text }),
    remove: (path: string) => step({ kind: 'remove', path }),
    read: (path: string) => step({ kind: 'read', path }),
    commit: (message: string) => step({ kind: 'commit', message }),
    branch: (name: string) => step({ kind: 'branch', name }),
    switch: (name: string) => step({ kind: 'switch', name }),
    merge: (name: string) => step({ kind: 'merge', name }),
    worktree: (name: string) => step({ kind: 'worktree', name }),
    fifo: (path: string) => step({ kind: 'fifo', path }),
    remote: (name: string, url: string) => step({ kind: 'remote', name, url }),
  };
}
