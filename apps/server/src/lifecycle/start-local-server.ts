import type { z } from 'zod';
import { startupSettingsSchema } from '../config/startup-settings.ts';
import { createServer } from '../http/server.ts';
import { claimDataDirectory } from './claim-data-directory.ts';

export async function startLocalServer(
  settings: z.input<typeof startupSettingsSchema>,
  signal?: AbortSignal,
) {
  const { dataDirectory, token, port, host, webRoot } =
    startupSettingsSchema.parse(settings);
  signal?.throwIfAborted();
  const ownership = claimDataDirectory(dataDirectory);
  const server = await openOwnedServer(ownership, token, webRoot, signal);
  try {
    signal?.throwIfAborted();
    const address = await server.listen({ host, port });
    const state: { closing?: Promise<void> } = {};
    return {
      address,
      close: () => {
        state.closing ??= closeOwnedServer(server, ownership.release);
        return state.closing;
      },
    };
  } catch (error) {
    await server.close();
    ownership.release();
    throw error;
  }
}

async function closeServer(server: Awaited<ReturnType<typeof createServer>>) {
  const deadline = setTimeout(() => server.server.closeAllConnections(), 5000);
  deadline.unref();
  try {
    await server.close();
  } finally {
    clearTimeout(deadline);
  }
}

async function openOwnedServer(
  ownership: ReturnType<typeof claimDataDirectory>,
  token: string,
  webRoot: string | undefined,
  signal?: AbortSignal,
) {
  try {
    return await createServer({
      dataDirectory: ownership.directory,
      token,
      ...(webRoot === undefined ? {} : { webRoot }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    ownership.release();
    throw error;
  }
}

async function closeOwnedServer(
  server: Awaited<ReturnType<typeof createServer>>,
  release: () => void,
) {
  await closeServer(server);
  release();
}
