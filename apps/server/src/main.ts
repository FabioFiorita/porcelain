import { readStartupSettings } from './config/startup-settings.ts';
import { startRuntime } from './lifecycle/runtime.ts';

/** Startup failures the operator can act on, as opposed to a bug. */
const actionable = new Set([
  'DataDirectoryOwnedError',
  'DataDirectoryInsecureError',
  'OwnerSocketUnreadableError',
  'SocketPathTooLongError',
]);

const shutdown = new AbortController();
const requestShutdown = () => shutdown.abort();
process.on('SIGINT', requestShutdown);
process.on('SIGTERM', requestShutdown);

try {
  const server = await startRuntime(
    readStartupSettings(process.env),
    shutdown.signal,
  );
  if (!shutdown.signal.aborted) {
    process.stdout.write(`${JSON.stringify({ address: server.address })}\n`);
    await new Promise<void>((resolve) => {
      shutdown.signal.addEventListener('abort', () => resolve(), {
        once: true,
      });
    });
  }
  await server.close();
} catch (error) {
  if (error !== shutdown.signal.reason) {
    process.stderr.write(
      error instanceof Error && actionable.has(error.name)
        ? `${error.message}\n`
        : 'Server startup or shutdown failed. Check configuration, data directory, and port availability.\n',
    );
    process.exitCode = 1;
  }
} finally {
  process.off('SIGINT', requestShutdown);
  process.off('SIGTERM', requestShutdown);
}
