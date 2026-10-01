import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { remoteTransport } from '@/shared/api/transport';
import { dropFileDrafts, saveFileDrafts } from '@/shared/query/file-drafts';
import { remoteApi } from '../api';
import { remoteStatusQueryOptions } from '../queries/remotes';
import { unsavedDraftsMessage } from '../rules/connection-error-message';
import { remoteLink, remoteStatus, type Remote } from '../rules/remotes';
import { useAccessStore, useRemotesStore } from '../store';

async function addRemote(value: string): Promise<Remote> {
  const link = remoteLink(value);
  if (!link)
    throw new ConnectionError(
      'Paste the whole link porcelain pair printed, starting with http.',
    );
  if (
    link.environmentId === useAccessStore.getState().connection?.environmentId
  )
    throw new ConnectionError('That link is for this computer.');
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const { credential, deviceId } = await remoteApi.pair(
    remoteTransport(link.address),
    link,
    signal,
  );
  const answer = await remoteApi.describe(
    remoteTransport(link.address, credential),
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
    deviceId,
  };
}

export function useAddRemote() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: addRemote,
    onSuccess: (remote) => {
      useRemotesStore.getState().save(remote);
      void client.invalidateQueries({
        predicate: (query) => query.queryKey.includes(remote.environmentId),
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

async function forgetRemote(remote: Remote) {
  if (!(await saveFileDrafts(remote.environmentId)))
    throw new ConnectionError(unsavedDraftsMessage);
  useRemotesStore.getState().forget(remote.environmentId);
  dropFileDrafts(remote.environmentId);
  return remote;
}

export function useForgetRemote() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: forgetRemote,
    onSuccess: (remote) =>
      client.removeQueries({
        queryKey: remoteStatusQueryOptions(remote).queryKey,
      }),
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRecheckRemote() {
  const client = useQueryClient();
  return (remote: Remote) =>
    client.invalidateQueries({
      queryKey: remoteStatusQueryOptions(remote).queryKey,
    });
}
