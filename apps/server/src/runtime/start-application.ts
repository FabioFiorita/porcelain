import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import type {
  HostPolicy,
  PairingReach,
  RuntimeStatus,
} from '@porcelain/access/models';
import type { Clock } from '@porcelain/kernel/ports';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { closeListener, type ClosableListener } from './close-listener.ts';
import { prepareDataDirectory } from './data-directory.ts';
import { acquireDirectoryLock } from './directory-lock.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import type { Job } from './job.ts';
import { restrictOwnerSocket } from './owner-socket.ts';

export type NetworkListener = ClosableListener & {
  listen(options: { host: string; port: number }): Promise<string>;
};

export type SocketListener = ClosableListener & {
  listen(options: { path: string }): Promise<string>;
};

export type OpenedServer = {
  jobs: readonly Job[];
  network: NetworkListener;
  owner: SocketListener;
  close(): Promise<void>;
};

export type OpenServer = (input: {
  settings: ServerSettings;
  pairingReach: () => PairingReach;
  runtimeStatus: () => RuntimeStatus;
  signal: AbortSignal;
}) => Promise<OpenedServer>;

export type ApplicationStarter = {
  openServer: OpenServer;
  ownerProbe: OwnerProbe;
  clock: Clock;
};

export type Runtime = {
  address: string;
  socketPath: string;
  close(): Promise<void>;
};

type RuntimeParts = {
  opened?: OpenedServer | undefined;
  jobs?: readonly Job[] | undefined;
};

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

async function shutDown(parts: RuntimeParts, graceMs: number) {
  const { opened, jobs } = parts;
  const failures: unknown[] = [];
  const stage = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      failures.push(error);
    }
  };
  if (opened) await stage(() => closeListener(opened.network, graceMs));
  if (jobs) await stage(() => stopJobs(jobs));
  if (opened) await stage(() => opened.close());
  if (opened) await stage(() => closeListener(opened.owner, graceMs));
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

export async function startApplication(
  settings: ServerSettings,
  signal: AbortSignal,
  starter: ApplicationStarter,
): Promise<Runtime> {
  const { host, port, allowedHosts, limits } = settings;
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
  const lock = await acquireDirectoryLock({
    path: join(directory, 'server.lock'),
    waitMs: limits.locks.startupWaitMs,
    pollMs: limits.locks.pollMs,
    staleTakeovers: limits.locks.staleTakeovers,
    clock: starter.clock,
    held: () => new DataDirectoryOwnedError(directory),
  });
  try {
    signal.throwIfAborted();
    const probe = await starter.ownerProbe.probe({
      socketPath,
      timeoutMs: limits.owner.probeTimeoutMs,
    });
    if (probe.kind === 'running') throw new DataDirectoryOwnedError(directory);
    if (probe.kind === 'unreadable')
      throw new OwnerSocketUnreadableError(socketPath, probe.reason);
    rmSync(socketPath, { force: true });
    signal.throwIfAborted();
    parts.opened = await starter.openServer({
      settings: { ...settings, dataDirectory: directory },
      pairingReach: () => reach,
      runtimeStatus: () => status,
      signal,
    });
    const opened = parts.opened;
    signal.throwIfAborted();
    parts.jobs = await startJobs(opened.jobs);
    const address = await opened.network.listen({ host, port });
    status.address = address;
    reach.port = Number(new URL(address).port);
    reach.policy = { allowedHosts, localAddresses: listeningOn(host) };
    await opened.owner.listen({ path: socketPath });
    restrictOwnerSocket(socketPath);
    const closing: { started?: Promise<void> } = {};
    return {
      address,
      socketPath,
      close: () => {
        closing.started ??= shutDown(parts, limits.listeners.closeGraceMs);
        return closing.started;
      },
    };
  } catch (error) {
    await shutDown(parts, limits.listeners.closeGraceMs).catch(() => undefined);
    throw error;
  } finally {
    await lock.release();
  }
}
