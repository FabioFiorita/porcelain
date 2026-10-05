import { Atom } from 'effect/reactivity';
import { useAtomSet } from '@effect/atom-react';
import { Effect } from 'effect';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@porcelain/client/transport';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { runRequest } from '@porcelain/client/transport';
import {
  AccessStore,
  pairEnvironment,
  readRemoteStatus,
} from '@porcelain/client/access';
import { pairingPlatform } from '../store';
import { FileDrafts, fileDraftRuntime } from '@porcelain/client/files';
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

const recheckRemote = Atom.fn((remote: Remote, get) =>
  Effect.sync(() => {
    get.registry.refresh(readRemoteStatus(pairingPlatform, remote));
  }),
);

export function useAddRemote() {
  const client = useQueryClient();
  const recheck = useAtomSet(recheckRemote);
  const mutation = useMutation({
    mutationFn: addRemote,
    onSuccess: (remote) => {
      recheck(remote);
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
  if (
    !(await Effect.runPromise(
      fileDraftRuntime.runSync(FileDrafts).save(remote.environmentId),
    ))
  )
    throw new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE });
  await Effect.runPromise(accessStore.forget(remote.environmentId));
  await Effect.runPromise(
    fileDraftRuntime.runSync(FileDrafts).drop(remote.environmentId),
  );
  return remote;
}

export function useForgetRemote() {
  const mutation = useMutation({ mutationFn: forgetRemote });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRecheckRemote() {
  return useAtomSet(recheckRemote);
}

export function useReadSavedEnvironments() {
  const mutation = useMutation({
    mutationFn: () => Effect.runPromise(accessStore.load()),
  });
  return { read: mutation.mutate, isPending: mutation.isPending };
}
