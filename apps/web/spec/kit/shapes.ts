import { Schema } from 'effect';
import {
  readServiceUpdateResponseSchema,
  type ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';

import type { EditFileRequest } from '@porcelain/contracts/files';
import type {
  AgentAction,
  ProjectHomeStep,
  RepoFixture,
  RepoStep,
} from './protocol.ts';

type Step = (step: RepoStep) => Promise<string>;

export function sampleRepository(step: Step, fixture: RepoFixture) {
  const { branch: initialBranch, ...rest } = fixture;
  return {
    ...rest,
    initialBranch,
    serviceUpdate: (state: ReadServiceUpdateResponse | 'error' | null) =>
      step({
        kind: 'service-update-fixture',
        state:
          state === null || state === 'error'
            ? state
            : Schema.encodeSync(readServiceUpdateResponseSchema)(state),
      }),
    write: (path: string, text: string) => step({ kind: 'write', path, text }),
    remove: (path: string) => step({ kind: 'remove', path }),
    rename: (from: string, to: string) => step({ kind: 'rename', from, to }),
    symlink: (target: string, path: string) =>
      step({ kind: 'symlink', target, path }),
    read: (path: string) => step({ kind: 'read', path }),
    commit: (message: string) => step({ kind: 'commit', message }),
    branch: (name: string) => step({ kind: 'branch', name }),
    tag: (name: string) => step({ kind: 'tag', name }),
    switch: (name: string) => step({ kind: 'switch', name }),
    merge: (name: string) => step({ kind: 'merge', name }),
    worktree: (name: string) => step({ kind: 'worktree', name }),
    detachWorktree: (name: string) => step({ kind: 'detach-worktree', name }),
    fifo: (path: string) => step({ kind: 'fifo', path }),
    remote: (name: string, url: string) => step({ kind: 'remote', name, url }),
  };
}

export type SampleRepository = ReturnType<typeof sampleRepository>;

export function agentOn(step: Step) {
  const act = async (action: AgentAction) => {
    await step({ kind: 'agent', action });
  };
  return {
    editFile: (edit: EditFileRequest) => act({ kind: 'edit-file', edit }),
  };
}

export type Agent = ReturnType<typeof agentOn>;

export function projectHomeOn(
  step: (step: ProjectHomeStep) => Promise<string>,
) {
  return {
    repository: (name: string) => step({ kind: 'repository', name }),
    folder: (name: string) => step({ kind: 'folder', name }),
  };
}

export type ProjectHome = ReturnType<typeof projectHomeOn>;
