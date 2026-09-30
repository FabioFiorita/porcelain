import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { remoteApi } from '../api';
import { remoteStatusQueryOptions } from '../queries/remotes';
import { remoteLink, remoteStatus, type Remote } from '../rules/remotes';
import { useRemotesStore } from '../store';

async function addRemote(value: string): Promise<Remote> {
  const link = remoteLink(value);
  if (!link)
    throw new ConnectionError(
      'Paste the whole link porcelain pair printed, starting with http.',
    );
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const credential = await remoteApi.pair(link, signal);
  const answer = await remoteApi.describe(
    { address: link.address, credential },
    signal,
  );
  const status = remoteStatus(link, answer);
  if (status.kind !== 'online')
    throw new ConnectionError(
      status.kind === 'other-server'
        ? 'Another Porcelain answered at that address than the one that made the link.'
        : status.kind === 'incompatible'
          ? 'That Porcelain runs a version this app cannot talk to. Update both to the same version.'
          : 'The remote paired but did not answer afterwards. Try again.',
    );
  return {
    environmentId: link.environmentId,
    name: status.name,
    address: link.address,
    credential,
  };
}

export function useAddRemote() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: addRemote,
    onSuccess: (remote) => {
      useRemotesStore.getState().save(remote);
      void client.invalidateQueries({
        queryKey: remoteStatusQueryOptions(remote).queryKey,
      });
    },
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    added: mutation.isSuccess ? mutation.data : undefined,
  };
}

export function useForgetRemote() {
  const client = useQueryClient();
  return (remote: Remote) => {
    useRemotesStore.getState().forget(remote.environmentId);
    client.removeQueries({
      queryKey: remoteStatusQueryOptions(remote).queryKey,
    });
  };
}
