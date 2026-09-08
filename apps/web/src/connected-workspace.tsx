import { readInventory } from '@porcelain/client/inventory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { Alert, AlertDescription } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from './components/ui/empty';
import { ProjectNavigator } from './project-navigator';

export type Connection = { token: string; environmentId: string };

export function ConnectedWorkspace({
  connection,
  onDisconnect,
}: {
  connection: Connection;
  onDisconnect: () => void;
}) {
  const client = useQueryClient();
  const [controller] = useState(() => new AbortController());
  const { worktree: selected } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const queryKey = ['inventory', connection.environmentId];
  const inventory = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const result = await readInventory({
        endpoint: '/api',
        token: connection.token,
        fetch,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      if (result.environmentId !== connection.environmentId)
        throw new Error(
          'The environment changed. Disconnect and connect again.',
        );
      return result;
    },
    staleTime: Infinity,
    retry: false,
  });
  const refresh = useMutation({
    mutationFn: async () => {
      await client.cancelQueries({ queryKey });
      const result = await readInventory({
        endpoint: '/api',
        token: connection.token,
        fetch,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
        refresh: true,
      });
      if (result.environmentId !== connection.environmentId)
        throw new Error(
          'The environment changed. Disconnect and connect again.',
        );
      return result;
    },
    onSuccess: (result) => {
      if (!controller.signal.aborted) client.setQueryData(queryKey, result);
    },
    retry: false,
  });
  const worktree = (inventory.data?.projects ?? [])
    .flatMap((project) => project.worktrees)
    .find((entry) => entry.id === selected);
  const error = refresh.error ?? inventory.error;
  return (
    <section className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">Environment</h2>
          <Badge variant="secondary">
            {error ? 'Needs attention' : 'Connected'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={refresh.isPending || inventory.isFetching}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              controller.abort();
              void client.cancelQueries({ queryKey });
              client.clear();
              void navigate({ search: {} });
              onDisconnect();
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.message} Displayed inventory may be out of date.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <ProjectNavigator
          projects={inventory.data?.projects ?? []}
          selected={selected ?? null}
          onSelect={(id) => {
            void navigate({ search: { worktree: id } });
          }}
        />
        <div className="min-w-0">
          {worktree ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">
                {worktree.branch?.replace(/^refs\/heads\//, '') ??
                  'Detached HEAD'}
              </h2>
              <p className="break-all text-sm text-muted-foreground">
                {worktree.path}
              </p>
              <Badge variant="outline">
                {worktree.available ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select a worktree</EmptyTitle>
                <EmptyDescription>
                  Choose a worktree to establish your review context.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </section>
  );
}
