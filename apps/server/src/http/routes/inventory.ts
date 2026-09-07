import { timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  inventoryResponseSchema,
  projectResponseSchema,
  registerProjectRequestSchema,
} from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { openApplication } from '../../app.ts';
import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';
import {
  toInventoryResponse,
  toProjectResponse,
} from '../mappers/inventory-response.ts';

export async function inventoryRoutes(
  server: FastifyInstance,
  options: {
    application: Awaited<ReturnType<typeof openApplication>>;
    token: string;
  },
) {
  const expected = Buffer.from(`Bearer ${options.token}`);
  server.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
  });
  server.setErrorHandler(async (error, _request, reply) => {
    if (
      error instanceof Error &&
      ('validation' in error ||
        ('statusCode' in error &&
          typeof error.statusCode === 'number' &&
          error.statusCode >= 400 &&
          error.statusCode < 500))
    ) {
      return reply
        .code(400)
        .send({ code: 'INVALID_REQUEST', message: 'Invalid request' });
    }
    if (isRepositoryUnavailable(error)) {
      return reply.code(422).send({
        code: 'REPOSITORY_UNAVAILABLE',
        message: 'Repository could not be inspected',
      });
    }
    if (
      error instanceof ApplicationClosedError ||
      (error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError'))
    ) {
      return reply.code(503).send({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Operation unavailable',
      });
    }
    return reply
      .code(500)
      .send({ code: 'INTERNAL_ERROR', message: 'Operation failed' });
  });
  const responses = {
    400: apiErrorSchema,
    401: apiErrorSchema,
    422: apiErrorSchema,
    503: apiErrorSchema,
    500: apiErrorSchema,
  };
  const routes = server.withTypeProvider<ZodTypeProvider>();
  routes.get(
    '/inventory',
    {
      schema: { response: { ...responses, 200: inventoryResponseSchema } },
    },
    async () => toInventoryResponse(options.application.inventory()),
  );
  routes.post(
    '/projects',
    {
      schema: {
        body: registerProjectRequestSchema.refine((input) =>
          isAbsolute(input.path),
        ),
        response: { ...responses, 200: projectResponseSchema },
      },
    },
    async (request) =>
      toProjectResponse(await options.application.register(request.body.path)),
  );
  routes.post(
    '/inventory/refresh',
    {
      schema: { response: { ...responses, 200: inventoryResponseSchema } },
    },
    async () => toInventoryResponse(await options.application.refresh()),
  );
}
