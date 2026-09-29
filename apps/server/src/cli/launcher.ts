import type { ServerSettings } from '../config/server-settings.ts';
import type { Runtime } from '../ports/runtime.ts';
import type { ServerHost } from '../ports/server-host.ts';

export type StartServer = (
  settings: ServerSettings,
  signal: AbortSignal,
  host: ServerHost,
) => Promise<Runtime>;

type LauncherDependencies = {
  startServer: StartServer;
  host: ServerHost;
  output: (message: string) => void;
};

async function waitForShutdown(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolveShutdown) =>
    signal.addEventListener('abort', () => resolveShutdown(), { once: true }),
  );
}

export async function runLocalServer(
  settings: ServerSettings,
  signal: AbortSignal,
  dependencies: LauncherDependencies,
): Promise<void> {
  const { output } = dependencies;
  signal.throwIfAborted();
  const server = await dependencies.startServer(
    settings,
    signal,
    dependencies.host,
  );
  try {
    if (signal.aborted) return;
    output(`Porcelain listening at ${server.address}`);
    output(`Owner socket: ${server.socketPath}`);
    output('Pair a device with: porcelain pair <name> --address <origin>');
    await waitForShutdown(signal);
  } finally {
    await server.close();
  }
}
