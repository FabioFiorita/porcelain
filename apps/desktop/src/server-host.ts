import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { utilityProcess } from 'electron';
import type { desktopSettings } from './settings.ts';
import { serverMessage } from './protocol.ts';
import { ServerLog } from './adapters/server-log.ts';

export async function startLocalServer(
  settings: ReturnType<typeof desktopSettings>,
) {
  const credential = randomBytes(
    settings.limits.credentials.secretBytes,
  ).toString('base64url');
  const child = utilityProcess.fork(settings.serverEntry, [], {
    serviceName: 'Porcelain Server',
    stdio: 'pipe',
    cwd: settings.projectHome,
  });
  const log = new ServerLog(
    settings.logs,
    settings.limits.desktop.serverLogBytes,
  );
  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(chunk);
    log.append(chunk);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    log.append(chunk);
  });
  const exited = new Promise<number>((resolveExit) =>
    child.once('exit', (code) => {
      process.stderr.write(`Porcelain server: exited ${code}\n`);
      resolveExit(code);
    }),
  );
  let stopping = false;
  const address = await new Promise<string>((resolveReady, rejectReady) => {
    const timeout = AbortSignal.timeout(settings.limits.desktop.startupMs);
    const expired = () => {
      child.kill();
      rejectReady(new Error('The local server did not start in time'));
    };
    timeout.addEventListener('abort', expired, { once: true });
    child.on('message', (message: unknown) => {
      const parsed = serverMessage.safeParse(message);
      if (!parsed.success) return;
      const answer = parsed.data;
      if (answer.kind === 'ready') {
        timeout.removeEventListener('abort', expired);
        resolveReady(answer.address);
      } else {
        const error = new Error(answer.message);
        rejectReady(error);
      }
    });
    child.once('spawn', () =>
      child.postMessage({
        kind: 'start',
        profile: settings.profile,
        projectHome: settings.projectHome,
        packageRoot: settings.packageRoot,
        session: {
          deviceId: randomUUID(),
          secretHash: createHash('sha256').update(credential).digest('hex'),
        },
      }),
    );
    child.once('exit', (code) => {
      timeout.removeEventListener('abort', expired);
      const error = new Error(`The local server exited (${code})`);
      rejectReady(error);
    });
  });
  return {
    address,
    exited,
    credential,
    close: async () => {
      if (child.pid === undefined) return;
      if (!stopping) {
        stopping = true;
        child.postMessage({ kind: 'stop' });
      }
      const timeout = AbortSignal.timeout(settings.limits.desktop.shutdownMs);
      const expired = () => child.kill();
      timeout.addEventListener('abort', expired, { once: true });
      await exited;
      timeout.removeEventListener('abort', expired);
      await log.flush();
    },
  };
}
