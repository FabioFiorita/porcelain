import { join } from 'node:path';
import {
  openAppManagedUpdateRunner,
  readServerSettings,
  startServer,
} from '@porcelain/server/desktop';
import { hostMessage } from './protocol.ts';

const parent = process.parentPort;
if (parent === null)
  throw new Error('The desktop server requires its app host');
const message = await new Promise<unknown>((resolveStart) =>
  parent.once('message', (event) => resolveStart(event.data)),
);
const startup = hostMessage.parse(message);
if (startup.kind !== 'start')
  throw new Error('The desktop server requires private startup configuration');
const { profile, projectHome, packageRoot, session } = startup;
const signal = new AbortController();
const settings = readServerSettings({
  dataDirectory: join(profile, 'server'),
  projectHome,
  host: '127.0.0.1',
  port: 0,
  webRoot: join(packageRoot, 'web'),
});

try {
  const server = await startServer(settings, signal.signal, {
    desktopSession: session,
    version: undefined,
    serviceUpdateRunner: openAppManagedUpdateRunner(),
  });
  let closing: Promise<void> | undefined;
  const close = () => {
    signal.abort();
    closing ??= server.close().finally(() => {
      process.stderr.write('Porcelain server: closed\n');
      process.exit();
    });
    return closing;
  };
  const handle = async (message: unknown) => {
    const parsed = hostMessage.parse(message);
    if (parsed.kind === 'stop') {
      await close();
      return;
    }
    throw new Error('The desktop server is already started');
  };
  parent.on('message', (event) => {
    void handle(event.data).catch((error: unknown) => {
      parent.postMessage({
        kind: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Local server command failed',
      });
    });
  });
  process.on('SIGTERM', () => {
    void close();
  });
  parent.postMessage({ kind: 'ready', address: server.address });
} catch (error) {
  parent.postMessage({
    kind: 'failed',
    message:
      error instanceof Error ? error.message : 'Local server startup failed',
  });
  process.exitCode = 1;
}
