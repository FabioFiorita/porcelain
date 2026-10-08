import type { EditFileRequest } from '@porcelain/contracts/files';
import type {
  AgentAction,
  ProjectHomeStep,
  ProofCheckStep,
  RepoFixture,
  RepoStep,
} from './protocol.ts';

type Step = (step: RepoStep) => Promise<string>;

export function sampleRepository(step: Step, fixture: RepoFixture) {
  const { branch: initialBranch, ...rest } = fixture;
  return {
    ...rest,
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

export type SampleRepository = ReturnType<typeof sampleRepository>;

export function agentOn(step: Step) {
  const act = async (action: AgentAction) => {
    await step({ kind: 'agent', action });
  };
  return {
    publishArchitecture: () => act({ kind: 'publish-architecture' }),
    publishReview: (
      title: string,
      kind: 'changed' | 'context' = 'changed',
      summaryHtml?: string,
    ) => act({ kind: 'publish-review', title, step: kind, summaryHtml }),
    publishProof: (
      title: string,
      proof: { checks: ProofCheckStep[]; screenshot: string },
    ) => act({ kind: 'publish-proof', title, ...proof }),
    comment: (path: string, body: string) =>
      act({ kind: 'comment', path, body }),
    reply: (threadId: string, body: string) =>
      act({ kind: 'reply', threadId, body }),
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
