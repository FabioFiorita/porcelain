import type { z } from 'zod';
import type { CommitGenerator } from '../agents/interfaces/commit-generator.ts';
import { startupSettingsSchema } from '../config/startup-settings.ts';
import type { FileWriter } from '../filesystem/interfaces/file-writer.ts';
import { createServer } from '../http/server.ts';
import { claimDataDirectory } from '../lifecycle/claim-data-directory.ts';

/**
 * Start the local HTTP server while owning its state directory for its entire
 * lifetime.  This is the runtime primitive shared by the repository launcher
 * and the installed `porcelain` executable.
 */
export async function startLocalServer(
  settings: z.input<typeof startupSettingsSchema>,
  signal?: AbortSignal,
  dependencies: {
    fileWriter?: FileWriter;
    commitGenerator?: CommitGenerator;
  } = {},
) {
  const { dataDirectory, token, port, host, webRoot } =
    startupSettingsSchema.parse(settings);
  signal?.throwIfAborted();
  const ownership = claimDataDirectory(dataDirectory);
  const server = await openOwnedServer(
    ownership,
    token,
    webRoot,
    signal,
    dependencies,
  );
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
  dependencies: {
    fileWriter?: FileWriter;
    commitGenerator?: CommitGenerator;
  } = {},
) {
  try {
    return await createServer({
      ...dependencies,
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
