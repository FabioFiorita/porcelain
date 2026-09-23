import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { ownerStatusSchema } from '@porcelain/contracts/owner';
import Fastify from 'fastify';
import type { Application } from '../application.ts';
import { toErrorResponse } from './mappers/error-response.ts';
import { registerOwnerRoutes } from './owner-routes.ts';

export type OwnerStatus = {
  address: string;
  dataDirectory: string;
  pid: number;
};

export function createOwnerServer(options: {
  status: () => OwnerStatus;
  application: Application;
}) {
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    return reply.code(response.statusCode).send(response.body);
  });
  server.decorateRequest('principal');
  server.addHook('onRequest', (request, _reply, done) => {
    request.principal = { kind: 'owner' };
    done();
  });
  server.get(
    '/status',
    { schema: { response: { 200: ownerStatusSchema } } },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return options.status();
    },
  );
  registerOwnerRoutes(server, { application: options.application });
  return server;
}
