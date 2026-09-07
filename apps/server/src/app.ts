import { randomUUID } from 'node:crypto';
import { basename, dirname } from 'node:path';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { healthResponseSchema } from '@porcelain/contracts/health';
import Fastify from 'fastify';
import { createGitInventory } from './inventory/git-inventory.ts';
import type {
  DiscoveredRepository,
  GitInventory,
  Project,
} from './inventory/inventory.ts';
import { openInventoryStore } from './inventory/inventory-store.ts';

function reconcile(
  discovered: DiscoveredRepository,
  previous?: Project,
): Project {
  return {
    id: previous?.id ?? randomUUID(),
    name: previous?.name ?? basename(dirname(discovered.commonDirectory)),
    commonDirectory: discovered.commonDirectory,
    repositoryIdentity: discovered.repositoryIdentity,
    available: true,
    worktrees: discovered.worktrees.map((worktree) => {
      const known = previous?.worktrees.find((candidate) =>
        worktree.metadataIdentity
          ? candidate.metadataIdentity === worktree.metadataIdentity
          : candidate.path === worktree.path,
      );
      return {
        ...worktree,
        id: known?.id ?? randomUUID(),
        metadataIdentity:
          worktree.metadataIdentity || known?.metadataIdentity || '',
      };
    }),
  };
}

async function rediscover(git: GitInventory, project: Project) {
  for (const worktree of project.worktrees) {
    try {
      const candidate = await git.discover(worktree.path);
      if (candidate.repositoryIdentity === project.repositoryIdentity)
        return candidate;
    } catch {
      // Another known checkout may still provide the repository inventory.
    }
  }
  return undefined;
}

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitInventory;
}) {
  const store = openInventoryStore(options.dataDirectory);
  const git = options.git ?? createGitInventory();
  // Serialize refresh and registration so older discovery cannot overwrite newer inventory.
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }
  async function refresh() {
    for (const project of store.read().projects) {
      const discovered = await rediscover(git, project);
      store.save(
        discovered
          ? reconcile(discovered, project)
          : {
              ...project,
              available: false,
              worktrees: project.worktrees.map((worktree) => ({
                ...worktree,
                available: false,
              })),
            },
      );
    }
    return store.read();
  }
  try {
    await refresh();
  } catch (error) {
    store.close();
    throw error;
  }
  return {
    inventory: () => store.read(),
    register: (checkout: string) =>
      serialize(async () => {
        await refresh();
        const discovered = await git.discover(checkout);
        const previous = store
          .read()
          .projects.find(
            (project) =>
              project.repositoryIdentity === discovered.repositoryIdentity,
          );
        const project = reconcile(discovered, previous);
        store.save(project);
        return project;
      }),
    refresh: () => serialize(refresh),
    close: () => serialize(async () => store.close()),
  };
}

export async function createServer(
  options: Parameters<typeof openApplication>[0],
) {
  const application = await openApplication(options);
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.addHook('onClose', async () => application.close());
  server.get(
    '/health',
    {
      schema: { response: { 200: healthResponseSchema } },
    },
    () => ({ status: 'ok' as const }),
  );
  return server;
}
