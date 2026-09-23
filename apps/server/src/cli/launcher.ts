import type { StartupSettingsInput } from '../config/startup-settings.ts';
import type { ServeSettings } from './arguments.ts';

export type StartServer = (
  settings: StartupSettingsInput,
  signal: AbortSignal,
) => Promise<{ address: string; socketPath: string; close(): Promise<void> }>;

export type LauncherDependencies = {
  startServer: StartServer;
  output?: (message: string) => void;
};

async function waitForShutdown(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolveShutdown) =>
    signal.addEventListener('abort', () => resolveShutdown(), { once: true }),
  );
}

export async function runLocalServer(
  settings: ServeSettings,
  signal: AbortSignal,
  dependencies: LauncherDependencies,
): Promise<void> {
  const output =
    dependencies.output ??
    ((message: string) => process.stdout.write(`${message}\n`));
  signal.throwIfAborted();
  const server = await dependencies.startServer(
    {
      dataDirectory: settings.dataDirectory,
      projectHome: settings.projectHome,
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
    output('Pair a device with: porcelain pair <name> --address <origin>');
    await waitForShutdown(signal);
  } finally {
    await server.close();
  }
}
