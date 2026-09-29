import { utilityProcess } from 'electron';
import type { desktopSettings } from './settings.ts';
import { serverMessage } from './protocol.ts';

export async function startLocalServer(
  settings: ReturnType<typeof desktopSettings>,
) {
  const child = utilityProcess.fork(
    settings.serverEntry,
    [settings.profile, settings.projectHome, settings.packageRoot],
    {
      serviceName: 'Porcelain Server',
      stdio: 'pipe',
      cwd: settings.projectHome,
    },
  );
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  const exited = new Promise<number>((resolveExit) =>
    child.once('exit', (code) => {
      process.stderr.write(`Porcelain server: exited ${code}\n`);
      resolveExit(code);
    }),
  );
  let stopping = false;
  let pairAnswer:
    | { resolve: (link: string) => void; reject: (error: Error) => void }
    | undefined;
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
      } else if (answer.kind === 'paired') {
        pairAnswer?.resolve(answer.link);
        pairAnswer = undefined;
      } else {
        const error = new Error(answer.message);
        rejectReady(error);
        pairAnswer?.reject(error);
        pairAnswer = undefined;
      }
    });
    child.once('exit', (code) => {
      timeout.removeEventListener('abort', expired);
      const error = new Error(`The local server exited (${code})`);
      rejectReady(error);
      pairAnswer?.reject(error);
      pairAnswer = undefined;
    });
  });
  return {
    address,
    exited,
    pairingLink: () =>
      new Promise<string>((resolvePair, rejectPair) => {
        pairAnswer = { resolve: resolvePair, reject: rejectPair };
        child.postMessage({ kind: 'pair' });
      }),
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
    },
  };
}
