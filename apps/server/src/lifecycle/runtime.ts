import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { CommitGenerator } from '../agents/interfaces/commit-generator.ts';
import { openApplication } from '../app.ts';
import type { Application } from '../application.ts';
import { startupSettingsSchema } from '../config/startup-settings.ts';
import type { FileWriter } from '../filesystem/interfaces/file-writer.ts';
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { prepareDataDirectory } from './data-directory.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import {
  ownerSocketPath,
  probeOwnerSocket,
  restrictOwnerSocket,
} from './owner-socket.ts';
import { acquireStartupLock } from './startup-lock.ts';

export type RuntimeDependencies = {
  fileWriter?: FileWriter;
  commitGenerator?: CommitGenerator;
  /**
   * Runs while the startup lock is held, after the socket has been claimed and
   * before anything is bound.  Tests pause a winner here to prove a contender
   * waits instead of removing a live guard.
   */
  onClaimed?: () => Promise<void> | void;
  /**
   * Runs after the network listener binds and before the owner socket does, so
   * a test can fail the second bind and check the first one was closed.
   */
  onNetworkBound?: (address: string) => Promise<void> | void;
};

export type Runtime = {
  address: string;
  socketPath: string;
  refreshed(): Promise<void>;
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

/**
 * Shut down whatever was built, in one order, for a clean stop and for a
 * failed start alike.
 *
 * The order is the single-owner guarantee. Closing the owner listener unlinks
 * the socket, and that absence is exactly what tells the next starter the
 * directory is free — so it must come last, after the application has finished
 * draining. Releasing it earlier lets a new server open the same database while
 * this one still holds lanes over the same repositories. The network door goes
 * first so nothing new arrives while the application unwinds.
 *
 * Every stage runs even when an earlier one fails: a listener that refuses to
 * close must not strand an open database, and the first failure is reported.
 */
async function shutDown(parts: {
  network?: FastifyInstance | undefined;
  owner?: FastifyInstance | undefined;
  application?: Application | undefined;
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
  // Nothing else removes the socket path: a start refused because another
  // server answers must not delete that server's live socket.
  if (owner) await stage(() => closeListener(owner));
  if (failures.length > 0) throw failures[0];
}

/** Start both doors over one application, or leave nothing running. */
export async function startRuntime(
  settings: z.input<typeof startupSettingsSchema>,
  signal?: AbortSignal,
  dependencies: RuntimeDependencies = {},
): Promise<Runtime> {
  const {
    dataDirectory,
    projectHome,
    token,
    port,
    host,
    webRoot,
    allowedHosts,
  } = startupSettingsSchema.parse(settings);
  signal?.throwIfAborted();
  const directory = prepareDataDirectory(dataDirectory);
  const socketPath = ownerSocketPath(directory);
  const { fileWriter, commitGenerator, onClaimed, onNetworkBound } =
    dependencies;
  const parts: {
    network?: FastifyInstance;
    owner?: FastifyInstance;
    application?: Application;
  } = {};
  const lock = await acquireStartupLock(directory);
  try {
    signal?.throwIfAborted();
    // Only a server that answers for itself proves the directory is taken; a
    // socket nothing listens on is what a crash leaves behind. Anything else
    // there stays untouched rather than being guessed at and removed.
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
      ...(fileWriter ? { fileWriter } : {}),
      ...(commitGenerator ? { commitGenerator } : {}),
      ...(signal ? { signal } : {}),
    });
    const application = parts.application;
    signal?.throwIfAborted();
    parts.network = createNetworkServer({
      application,
      token,
      ...(webRoot === undefined ? {} : { webRoot }),
      allowedHosts,
    });
    const address = await parts.network.listen({ host, port });
    await onNetworkBound?.(address);
    parts.owner = createOwnerServer({
      status: () => ({ address, dataDirectory: directory, pid: process.pid }),
    });
    await parts.owner.listen({ path: socketPath });
    // The owner door is not ready until its mode is narrowed and confirmed.
    restrictOwnerSocket(socketPath);
    const closing: { started?: Promise<void> } = {};
    return {
      address,
      socketPath,
      refreshed: () => application.ready(),
      close: () => {
        closing.started ??= shutDown(parts);
        return closing.started;
      },
    };
  } catch (error) {
    // A failed shutdown must not hide why the start failed.
    await shutDown(parts).catch(() => undefined);
    throw error;
  } finally {
    lock.release();
  }
}
