import type { EditFileRequest } from '@porcelain/contracts/files';
import { hostCommands } from './commands';
import type { AgentAction } from './protocol';

const act = async (action: AgentAction) => {
  await hostCommands.porcelainRepo({ kind: 'agent', action });
};

export const agent = {
  publishReview: (title: string) => act({ kind: 'publish-review', title }),
  comment: (path: string, body: string) => act({ kind: 'comment', path, body }),
  editFile: (edit: EditFileRequest) => act({ kind: 'edit-file', edit }),
};
