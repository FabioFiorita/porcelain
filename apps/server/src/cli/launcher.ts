import { startRuntime } from '../lifecycle/runtime.ts';
import type { ServeSettings } from './arguments.ts';
import { ensureAccessToken } from './token.ts';

type StartedRuntime = Awaited<ReturnType<typeof startRuntime>>;

export type LauncherDependencies = {
  startServer?: typeof startRuntime;
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
  const start = dependencies.startServer ?? startRuntime;
  const token = await ensureAccessToken(settings.tokenFile);
  signal.throwIfAborted();
  const server: StartedRuntime = await start(
    {
      dataDirectory: settings.dataDirectory,
      projectHome: settings.projectHome,
      token,
      host: settings.host,
      port: settings.port,
      webRoot: settings.webRoot,
      allowedHosts: settings.allowedHosts,
    },
    signal,
  );
  try {
    if (signal.aborted) return;
    output(`Porcelain listening at ${server.address}`);
    output(`Owner socket: ${server.socketPath}`);
    output(`Access token file: ${settings.tokenFile}`);
    await waitForShutdown(signal);
  } finally {
    await server.close();
  }
}
