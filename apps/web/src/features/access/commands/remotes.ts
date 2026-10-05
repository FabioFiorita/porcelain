import { Effect } from 'effect';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@porcelain/client/transport';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { runRequest } from '@porcelain/client/transport';
import {
  AccessStore,
  pairEnvironment,
  remoteStatusQueryOptions,
} from '@porcelain/client/access';
import { pairingPlatform } from '../store';
import { dropFileDrafts, saveFileDrafts } from '@porcelain/client/files';
import { UNSAVED_DRAFTS_MESSAGE } from '@porcelain/client/access/rules';
import { remoteLink, type Remote } from '@porcelain/client/access/rules';
import { accessSession, accessStore } from '../store';

function addRemote(value: string): Promise<Remote> {
  const link = remoteLink(value);
  if (
    link?.environmentId === accessSession.state.value.connection?.environmentId
  )
    return Promise.reject(
      new ConnectionError({ message: 'That link is for this computer.' }),
    );
  return runRequest(
    pairEnvironment(pairingPlatform, value).pipe(
      Effect.provideService(AccessStore, accessStore),
    ),
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  );
}

export function useAddRemote() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: addRemote,
    onSuccess: (remote) => {
      void client.invalidateQueries({
        predicate: (query) => query.queryKey.includes(remote.environmentId),
      });
    },
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    added: mutation.isSuccess ? mutation.data : undefined,
  };
}

async function forgetRemote(remote: Remote) {
  if (!(await Effect.runPromise(saveFileDrafts(remote.environmentId))))
    throw new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE });
  await Effect.runPromise(accessStore.forget(remote.environmentId));
  await Effect.runPromise(dropFileDrafts(remote.environmentId));
  return remote;
}

export function useForgetRemote() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: forgetRemote,
    onSuccess: (remote) =>
      client.removeQueries({
        queryKey: remoteStatusQueryOptions(pairingPlatform, remote).queryKey,
      }),
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRecheckRemote() {
  const client = useQueryClient();
  return (remote: Remote) =>
    client.invalidateQueries({
      queryKey: remoteStatusQueryOptions(pairingPlatform, remote).queryKey,
    });
}

export function useReadSavedEnvironments() {
  const mutation = useMutation({
    mutationFn: () => Effect.runPromise(accessStore.load()),
  });
  return { read: mutation.mutate, isPending: mutation.isPending };
}
