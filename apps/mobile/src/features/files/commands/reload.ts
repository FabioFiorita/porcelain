import type { useDirectory } from '../queries/reads';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewSurfaceFilters } from '@porcelain/client/transport';

const surfaces = new Set(['directory', 'paths']);

export function useReloadFiles({
  connection,
  scope,
}: Parameters<typeof useDirectory>[0]) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      client.invalidateQueries(
        reviewSurfaceFilters(connection.environmentId, scope, surfaces),
      ),
  });
  return { read: mutation.mutate, isPending: mutation.isPending };
}
