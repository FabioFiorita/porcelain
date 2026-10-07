import { Effect, Layer, ManagedRuntime, Schema, Scope } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { join } from 'node:path';
import {
  openAppManagedUpdateRunner,
  readServerSettings,
  startServer,
} from '@porcelain/server/desktop';
import { hostMessage } from './protocol.ts';
import { finishServerOutput } from './adapters/server-output.ts';

const parent = process.parentPort;
if (parent === null)
  throw new Error('The desktop server requires its app host');
const message = await new Promise<unknown>((resolveStart) =>
  parent.once('message', (event) => resolveStart(event.data)),
);
const startup = Schema.decodeUnknownSync(hostMessage)(message);
if (startup.kind !== 'start')
  throw new Error('The desktop server requires private startup configuration');
const { profile, projectHome, packageRoot, session, outputEnd } = startup;
const signal = new AbortController();
const settings = readServerSettings({
  dataDirectory: join(profile, 'server'),
  projectHome,
  host: '127.0.0.1',
  port: 0,
  webRoot: join(packageRoot, 'web'),
});

const runtime = ManagedRuntime.make(
  Layer.merge(NodeServices.layer, Layer.effect(Scope.Scope, Effect.scope)),
);

try {
  const server = await runtime.runPromise(
    startServer(settings, {
      desktopSession: session,
      version: undefined,
      serviceUpdateRunner: openAppManagedUpdateRunner(),
    }),
    { signal: signal.signal },
  );
  let closing: Promise<void> | undefined;
  const close = () => {
    signal.abort();
    closing ??= (async () => {
      try {
        await runtime.runPromise(server.close());
      } finally {
        try {
          await runtime.dispose();
        } finally {
          await finishServerOutput(outputEnd);
        }
      }
    })();
    return closing;
  };
  const handle = async (message: unknown) => {
    const parsed = Schema.decodeUnknownSync(hostMessage)(message);
    if (parsed.kind === 'stop') {
      await close();
      return;
    }
    if (parsed.kind === 'exit' && closing !== undefined) {
      await closing;
      process.exit();
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
  await runtime.dispose().catch(() => undefined);
  parent.postMessage({
    kind: 'failed',
    message:
      error instanceof Error ? error.message : 'Local server startup failed',
  });
  process.exitCode = 1;
}
