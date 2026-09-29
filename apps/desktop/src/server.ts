import { readDesktopLimits } from '@porcelain/server/desktop-settings';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  askOwner,
  openServiceUpdateRunner,
  readServerSettings,
  startServer,
} from '@porcelain/server/desktop';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import { hostMessage } from './protocol.ts';

const parent = process.parentPort;
if (parent === null)
  throw new Error('The desktop server requires its app host');
const [profile, projectHome, packageRoot] = process.argv.slice(2);
if (
  profile === undefined ||
  projectHome === undefined ||
  packageRoot === undefined
)
  throw new Error('The desktop server requires its owned paths');
const limits = readDesktopLimits();
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
    serviceUpdateRunner: openServiceUpdateRunner({
      homeDirectory: homedir(),
      packageRoot,
      searchPath: process.env.PATH ?? '',
      command: limits.installer,
    }),
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
    const answer = issuePairingResponseSchema.parse(
      await askOwner(
        settings.dataDirectory,
        'POST',
        '/pairings',
        {
          labels: ['Porcelain on this Mac'],
          addresses: [server.address],
        },
        limits.owner,
      ),
    );
    const grant = answer.grants[0];
    if (grant === undefined)
      throw new Error('The local server did not issue a pairing');
    parent.postMessage({ kind: 'paired', link: pairingLink(grant.link) });
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
