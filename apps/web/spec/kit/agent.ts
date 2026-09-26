import type { EditFileRequest } from '@porcelain/contracts/files';
import { hostCommands } from './commands';
import type { AgentAction } from './protocol';

const act = async (action: AgentAction) => {
  await hostCommands.porcelainRepo({ kind: 'agent', action });
};

export const agent = {
  publishReview: (title: string, step: 'changed' | 'context' = 'changed') =>
    act({ kind: 'publish-review', title, step }),
  comment: (path: string, body: string) => act({ kind: 'comment', path, body }),
  editFile: (edit: EditFileRequest) => act({ kind: 'edit-file', edit }),
};
