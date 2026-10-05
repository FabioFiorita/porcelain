import { projectFolderQueryOptions } from '@porcelain/client/projects';
import { useQuery } from '@tanstack/react-query';
import type { Connection } from '@/shared/workspace/connection';

export function useProjectFolder(
  connection: Connection,
  path: string | undefined,
  enabled: boolean,
) {
  return useQuery({ ...projectFolderQueryOptions(connection, path), enabled });
}
