import type { EditFileRequest } from '@porcelain/contracts/files';
import { hostCommands } from './commands';
import type { AgentAction, ProofCheckStep } from './protocol';

const act = async (action: AgentAction) => {
  await hostCommands.porcelainRepo({ kind: 'agent', action });
};

export const agent = {
  publishReview: (title: string, step: 'changed' | 'context' = 'changed') =>
    act({ kind: 'publish-review', title, step }),
  publishProof: (
    title: string,
    proof: { checks: ProofCheckStep[]; screenshot: string },
  ) => act({ kind: 'publish-proof', title, ...proof }),
  comment: (path: string, body: string) => act({ kind: 'comment', path, body }),
  reply: (threadId: string, body: string) =>
    act({ kind: 'reply', threadId, body }),
  editFile: (edit: EditFileRequest) => act({ kind: 'edit-file', edit }),
};
