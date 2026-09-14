import type { ServeSettings } from './arguments.ts';
import { startLocalServer } from './start-local-server.ts';
import { ensureAccessToken } from './token.ts';

type StartedServer = Awaited<ReturnType<typeof startLocalServer>>;

export type LauncherDependencies = {
  startServer?: typeof startLocalServer;
  output?: (message: string) => void;
};

async function waitForShutdown(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolveShutdown) =>
    signal.addEventListener('abort', () => resolveShutdown(), { once: true }),
  );
}

/**
 * Start the configured server and keep it alive until the supplied signal is
 * aborted.  Both `pnpm serve` and the installed package use this lifecycle.
 */
export async function runLocalServer(
  settings: ServeSettings,
  signal: AbortSignal,
  dependencies: LauncherDependencies = {},
): Promise<void> {
  const output =
    dependencies.output ??
    ((message: string) => process.stdout.write(`${message}\n`));
  const start = dependencies.startServer ?? startLocalServer;
  const token = await ensureAccessToken(settings.tokenFile);
  signal.throwIfAborted();
  const server: StartedServer = await start(
    {
      dataDirectory: settings.dataDirectory,
      token,
      host: settings.host,
      port: settings.port,
      webRoot: settings.webRoot,
    },
    signal,
  );
  try {
    if (signal.aborted) return;
    output(`Porcelain listening at ${server.address}`);
    output(`Access token file: ${settings.tokenFile}`);
    await waitForShutdown(signal);
  } finally {
    await server.close();
  }
}
