import { Schema } from 'effect';
import {
  readServiceUpdateResponseSchema,
  type ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import { reviewFixtureSchema } from './protocol.ts';
import type { EditFileRequest } from '@porcelain/contracts/files';
import type { CreateCommentThreadRequest } from '@porcelain/contracts/reviews';
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
    serviceUpdate: (state: ReadServiceUpdateResponse | 'error' | null) =>
      step({
        kind: 'service-update-fixture',
        state:
          state === null || state === 'error'
            ? state
            : Schema.encodeSync(readServiceUpdateResponseSchema)(state),
      }),
    review: async (title: string, asked?: string) =>
      Schema.decodeUnknownSync(reviewFixtureSchema)(
        JSON.parse(
          await step({
            kind: 'review-fixture',
            operation: 'publish',
            title,
            asked,
          }),
        ),
      ),
    advanceReviewBranch: () =>
      step({ kind: 'review-fixture', operation: 'advance', title: '' }),
    removeReviewRepository: () =>
      step({
        kind: 'review-fixture',
        operation: 'remove-repository',
        title: '',
      }),
    removeReviewWorktree: () =>
      step({ kind: 'review-fixture', operation: 'remove-worktree', title: '' }),
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
    publishArchitecture: (
      options: Omit<
        Extract<AgentAction, { kind: 'publish-architecture' }>,
        'kind'
      > = {},
    ) => act({ kind: 'publish-architecture', ...options }),
    publishReview: (
      title: string,
      kind: 'changed' | 'context' = 'changed',
      summaryHtml?: string,
    ) => act({ kind: 'publish-review', title, step: kind, summaryHtml }),
    publishProof: (
      title: string,
      proof: { checks: ProofCheckStep[]; screenshot: string },
    ) => act({ kind: 'publish-proof', title, ...proof }),
    comment: (
      path: string,
      body: string,
      thread?: Omit<CreateCommentThreadRequest, 'body'>,
    ) => act({ kind: 'comment', path, body, thread }),
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
