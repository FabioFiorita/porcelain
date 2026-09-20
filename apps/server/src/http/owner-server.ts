import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { ownerStatusSchema } from '@porcelain/contracts/owner';
import Fastify from 'fastify';
import { toErrorResponse } from './mappers/error-response.ts';

export type OwnerStatus = {
  address: string;
  dataDirectory: string;
  pid: number;
};

/**
 * The owner's door.  Reaching this listener means passing the data directory's
 * file permissions, so the caller is the owner and nothing here re-checks a
 * token.  It is a separate instance rather than a transport test on shared
 * routes: owner operations are then unreachable over the network by
 * construction, not by remembering a condition on every route.
 */
export function createOwnerServer(options: { status: () => OwnerStatus }) {
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(async (error, _request, reply) => {
    const response = toErrorResponse(error);
    return reply.code(response.statusCode).send(response.body);
  });
  // Reaching this listener is the credential, so the principal is fixed.
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
  return server;
}
