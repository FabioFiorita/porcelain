import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewSurfaceFilters } from '@porcelain/client/transport';
import type { FilesContext } from '@porcelain/client/files';

const surfaces = new Set(['directory', 'paths']);

export function useReloadFiles({ connection, scope }: FilesContext) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      client.invalidateQueries(
        reviewSurfaceFilters(connection.environmentId, scope, surfaces),
      ),
  });
  return { read: mutation.mutate, isPending: mutation.isPending };
}
