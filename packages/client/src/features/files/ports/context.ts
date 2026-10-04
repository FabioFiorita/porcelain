import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';

export type FilesContext = {
  connection: WorktreeConnection;
  scope: WorktreeScope;
};
