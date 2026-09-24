import { rmSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { openApplication, type ServerApplication } from './compose-server.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Job } from '../jobs/job.ts';
import type { IssuePairingResponse } from '@porcelain/contracts/access';
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { probeOwnerSocket } from '../cli/owner-client.ts';
import type { HostPolicy, RuntimeStatus } from '@porcelain/access/models';
import { prepareDataDirectory } from './data-directory.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import { restrictOwnerSocket } from './owner-socket.ts';
import { acquireStartupLock } from './startup-lock.ts';

export type Runtime = {
  address: string;
  socketPath: string;
  issuePairing(
    labels: readonly string[],
    addresses: readonly string[],
  ): Promise<IssuePairingResponse['grants']>;
  close(): Promise<void>;
};

const LISTENER_CLOSE_GRACE_MS = 5000;

type RuntimeParts = {
  network?: FastifyInstance | undefined;
  owner?: FastifyInstance | undefined;
  application?: ServerApplication | undefined;
  jobs?: readonly Job[] | undefined;
};

async function closeListener(server: FastifyInstance) {
  const deadline = setTimeout(
    () => server.server.closeAllConnections(),
    LISTENER_CLOSE_GRACE_MS,
  );
  deadline.unref();
  try {
    await server.close();
  } finally {
    clearTimeout(deadline);
  }
}

async function startJobs(jobs: readonly Job[]): Promise<readonly Job[]> {
  const started: Job[] = [];
  try {
    for (const job of jobs) {
      job.start();
      started.push(job);
    }
  } catch (error) {
    await stopJobs(started);
    throw error;
  }
  return started;
}

async function stopJobs(jobs: readonly Job[]): Promise<void> {
  for (const job of jobs) await job.stop();
}

async function shutDown(parts: RuntimeParts) {
  const { network, owner, application, jobs } = parts;
  const failures: unknown[] = [];
  const stage = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      failures.push(error);
    }
  };
  if (network) await stage(() => closeListener(network));
  if (jobs) await stage(() => stopJobs(jobs));
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
  settings: ServerSettings,
  signal: AbortSignal,
): Promise<Runtime> {
  const { host, port, allowedHosts } = settings;
  signal.throwIfAborted();
  const directory = prepareDataDirectory(settings.dataDirectory);
  const socketPath = ownerSocketPath(directory);
  const parts: RuntimeParts = {};
  const reach: { port: number; policy: HostPolicy } = {
    port: 0,
    policy: { allowedHosts, localAddresses: [] },
  };
  const status: RuntimeStatus = {
    address: '',
    dataDirectory: directory,
    pid: process.pid,
  };
  const lock = await acquireStartupLock(directory);
  try {
    signal.throwIfAborted();
    const probe = await probeOwnerSocket(socketPath);
    if (probe.kind === 'running') throw new DataDirectoryOwnedError(directory);
    if (probe.kind === 'unreadable')
      throw new OwnerSocketUnreadableError(socketPath, probe.reason);
    rmSync(socketPath, { force: true });
    signal.throwIfAborted();
    parts.application = await openApplication(
      { ...settings, dataDirectory: directory },
      {
        pairingReach: () => reach,
        runtimeStatus: () => status,
        signal,
      },
    );
    const application = parts.application;
    signal.throwIfAborted();
    parts.jobs = await startJobs(application.jobs);
    parts.network = createNetworkServer({ application, settings });
    const address = await parts.network.listen({ host, port });
    status.address = address;
    reach.port = Number(new URL(address).port);
    reach.policy = { allowedHosts, localAddresses: listeningOn(host) };
    parts.owner = createOwnerServer({ application });
    await parts.owner.listen({ path: socketPath });
    restrictOwnerSocket(socketPath);
    const closing: { started?: Promise<void> } = {};
    return {
      address,
      socketPath,
      issuePairing: async (labels, addresses) =>
        (
          await application.access.issuePairing.execute(
            { labels: [...labels], addresses: [...addresses] },
            {},
          )
        ).grants,
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
