import { rmSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type {
  CommitGeneratorPort,
  CommitModelCatalogPort,
} from '@porcelain/git-actions/ports';
import { openApplication } from './compose-server.ts';
import type { ServerCapabilities } from './server-capabilities.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { startupSettingsSchema } from '../config/startup-settings.ts';
import type { FileWriter } from '@porcelain/files/ports';
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { probeOwnerSocket } from '../http/helpers/owner-socket-client.ts';
import type { HostPolicy } from '@porcelain/access/models';
import { prepareDataDirectory } from './data-directory.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import { restrictOwnerSocket } from './owner-socket.ts';
import { acquireStartupLock } from './startup-lock.ts';

export type RuntimeDependencies = {
  fileWriter?: FileWriter;
  commitGenerator?: CommitGeneratorPort & CommitModelCatalogPort;
  onClaimed?: () => Promise<void> | void;
  onNetworkBound?: (address: string) => Promise<void> | void;
};

export type Runtime = {
  address: string;
  socketPath: string;
  refreshed(): Promise<void>;
  issuePairing: ServerCapabilities['issuePairing'];
  close(): Promise<void>;
};

async function closeListener(server: FastifyInstance) {
  const deadline = setTimeout(() => server.server.closeAllConnections(), 5000);
  deadline.unref();
  try {
    await server.close();
  } finally {
    clearTimeout(deadline);
  }
}

async function shutDown(parts: {
  network?: FastifyInstance | undefined;
  owner?: FastifyInstance | undefined;
  application?: ServerCapabilities | undefined;
}) {
  const { network, owner, application } = parts;
  const failures: unknown[] = [];
  const stage = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      failures.push(error);
    }
  };
  if (network) await stage(() => closeListener(network));
  if (application) await stage(() => application.close());
  if (owner) await stage(() => closeListener(owner));
  if (failures.length > 0) throw failures[0];
}

function listeningOn(host: string): string[] {
  if (host !== '0.0.0.0' && host !== '::') return [host];
  const families = host === '0.0.0.0' ? ['IPv4'] : ['IPv4', 'IPv6'];
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => families.includes(entry.family))
    .map((entry) => entry.address);
}

export async function startRuntime(
  settings: z.input<typeof startupSettingsSchema>,
  signal?: AbortSignal,
  dependencies: RuntimeDependencies = {},
): Promise<Runtime> {
  const { dataDirectory, projectHome, port, host, webRoot, allowedHosts } =
    startupSettingsSchema.parse(settings);
  signal?.throwIfAborted();
  const directory = prepareDataDirectory(dataDirectory);
  const socketPath = ownerSocketPath(directory);
  const { fileWriter, commitGenerator, onClaimed, onNetworkBound } =
    dependencies;
  const parts: {
    network?: FastifyInstance;
    owner?: FastifyInstance;
    application?: ServerCapabilities;
  } = {};
  const reach: { port: number; policy: HostPolicy } = {
    port: 0,
    policy: { allowedHosts, localAddresses: [] },
  };
  const lock = await acquireStartupLock(directory);
  try {
    signal?.throwIfAborted();
    const probe = await probeOwnerSocket(socketPath);
    if (probe.kind === 'running') throw new DataDirectoryOwnedError(directory);
    if (probe.kind === 'unreadable')
      throw new OwnerSocketUnreadableError(socketPath, probe.reason);
    rmSync(socketPath, { force: true });
    await onClaimed?.();
    signal?.throwIfAborted();
    parts.application = await openApplication({
      dataDirectory: directory,
      projectHome,
      pairingReach: () => reach,
      ...(fileWriter ? { fileWriter } : {}),
      ...(commitGenerator ? { commitGenerator } : {}),
      ...(signal ? { signal } : {}),
    });
    const application = parts.application;
    signal?.throwIfAborted();
    parts.network = createNetworkServer({
      application,
      ...(webRoot === undefined ? {} : { webRoot }),
      allowedHosts,
    });
    const address = await parts.network.listen({ host, port });
    reach.port = Number(new URL(address).port);
    reach.policy = { allowedHosts, localAddresses: listeningOn(host) };
    await onNetworkBound?.(address);
    parts.owner = createOwnerServer({
      application,
      status: () => ({ address, dataDirectory: directory, pid: process.pid }),
    });
    await parts.owner.listen({ path: socketPath });
    restrictOwnerSocket(socketPath);
    const closing: { started?: Promise<void> } = {};
    return {
      address,
      socketPath,
      refreshed: () => application.ready(),
      issuePairing: (labels, addresses) =>
        application.issuePairing(labels, addresses),
      close: () => {
        closing.started ??= shutDown(parts);
        return closing.started;
      },
    };
  } catch (error) {
    await shutDown(parts).catch(() => undefined);
    throw error;
  } finally {
    lock.release();
  }
}
