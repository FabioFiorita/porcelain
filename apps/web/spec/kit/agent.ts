import type { EditFileRequest } from '@porcelain/contracts/files';
import { hostCommands } from './commands';
import type { AgentAction, ProofCheckStep, ServerName } from './protocol';

export function agentOn(server: ServerName) {
  const act = async (action: AgentAction) => {
    await hostCommands.porcelainRepo({ kind: 'agent', action }, server);
  };

  return {
    publishReview: (
      title: string,
      step: 'changed' | 'context' = 'changed',
      summaryHtml?: string,
    ) => act({ kind: 'publish-review', title, step, summaryHtml }),
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

export const agent = agentOn('this');
