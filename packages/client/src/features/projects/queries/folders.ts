import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';

export function readProjectFolder(
  connection: RuntimeConnection,
  path: string | undefined,
) {
  return porcelainClient(connection).query('projects', 'browseProjectFolders', {
    query: path === undefined ? {} : { path },
  });
}
