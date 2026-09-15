import { isAbsolute } from 'node:path';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  projectDiscoveryResponseSchema,
  projectFolderQuerySchema,
  projectFolderResponseSchema,
} from '@porcelain/contracts/inventory';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function projectLocationRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  const routes = server.withTypeProvider<ZodTypeProvider>();
  routes.get(
    '/projects/discover',
    {
      schema: {
        response: { ...errorResponses, 200: projectDiscoveryResponseSchema },
      },
    },
    (_request, reply) =>
      readUntilClosed(reply, (signal) =>
        options.application.discoverProjects(signal),
      ),
  );
  routes.get(
    '/projects/folders',
    {
      schema: {
        querystring: projectFolderQuerySchema.refine(
          ({ path }) => path === undefined || isAbsolute(path),
        ),
        response: { ...errorResponses, 200: projectFolderResponseSchema },
      },
    },
    (request, reply) =>
      readUntilClosed(reply, (signal) =>
        options.application.browseProjectFolders(request.query.path, signal),
      ),
  );
}

async function readUntilClosed<T>(
  reply: FastifyReply,
  read: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const closed = () => {
    if (!reply.raw.writableFinished) controller.abort();
  };
  reply.raw.once('close', closed);
  try {
    return await read(controller.signal);
  } finally {
    reply.raw.removeListener('close', closed);
  }
}
