import type { z } from 'zod';
import { startupSettingsSchema } from '../config/startup-settings.ts';
import { createServer } from '../http/server.ts';
import { claimDataDirectory } from './claim-data-directory.ts';

export async function startLocalServer(
  settings: z.infer<typeof startupSettingsSchema>,
  signal?: AbortSignal,
) {
  const { dataDirectory, token, port } = startupSettingsSchema.parse(settings);
  signal?.throwIfAborted();
  const ownership = claimDataDirectory(dataDirectory);
  const server = await createServer({
    dataDirectory: ownership.directory,
    token,
    ...(signal ? { signal } : {}),
  }).catch((error: unknown) => {
    ownership.release();
    throw error;
  });
  try {
    signal?.throwIfAborted();
    const address = await server.listen({ host: '127.0.0.1', port });
    const state: { closing?: Promise<void> } = {};
    return {
      address,
      close: () => {
        state.closing ??= closeServer(server).then(() => ownership.release());
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
