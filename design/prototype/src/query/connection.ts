import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { SessionResponse } from '../contracts/connection';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

/** Whether this browser is paired, and whether the live channel is connected. */
export function useConnectionState() {
  const { connection } = useWorkspaceContext();
  return useSyncExternalStore(connection.subscribe, connection.get);
}

/** This device and the server it talks to, for Settings. */
export function useSession(): SessionResponse {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.session(environmentId),
    queryFn: ({ signal }) => api.connection.session({ signal }),
  }).data;
}

/** Redeems a pairing link, then reloads everything this browser could not read before. */
export function usePair() {
  const { api, connection } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: { code: string; label: string }) =>
        api.connection.pair(input),
      onSuccess: async () => {
        connection.setPairing('paired');
        client.removeQueries();
        await client.invalidateQueries();
      },
    }),
  );
}

/** Forgets this browser on the server; the pairing screen comes back. */
export function useForgetDevice() {
  const { api, connection } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: () => api.connection.forget(),
      onSuccess: () => {
        client.removeQueries();
        connection.setPairing('unpaired');
      },
    }),
  );
}

/** The code inside a pairing link (`…/pair#code=…`), or the text itself when it is just the code. */
export function pairingCode(link: string): string {
  const trimmed = link.trim();
  const match = /[#?&]code=([^&#\s]+)/.exec(trimmed);
  return match?.[1] ?? trimmed;
}
