import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';

export function readProjectFolder(
  connection: WorktreeConnection,
  path: string | undefined,
) {
  return porcelainClient(connection).query('projects', 'browseProjectFolders', {
    query: path === undefined ? {} : { path },
  });
}
