import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useMutation } from '@tanstack/react-query';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function connectionErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'Could not connect to the environment. Try again.';
}

export function useConnection() {
  const { connection, disconnect, disconnectError, disconnectPending } =
    useWorkspaceContext();
  return {
    connected: connection !== null,
    disconnect,
    disconnectError,
    disconnectPending,
  };
}

export function useConnect() {
  const { api, beginConnection } = useWorkspaceContext();
  return asMutation(
    // Session completion seeds/clears the cache in WorkspaceProvider; this is not a server-data write.
    // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
    useMutation({
      mutationFn: async (value: string) => {
        const complete = beginConnection();
        const token = value.trim();
        const inventory = await api.inventory.read({
          token,
          signal: AbortSignal.timeout(15_000),
        });
        return (
          complete?.(
            import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE
              ? token
              : 'browser-session',
            inventory,
          ) ?? false
        );
      },
    }),
  );
}
