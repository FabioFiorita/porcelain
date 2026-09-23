import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { handleError } from './error-handler.ts';
import { ownerScope, type OwnerControllers } from './scopes/owner.ts';

export function createOwnerServer(options: { application: OwnerControllers }) {
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(handleError);
  server.register(sensible);
  server.decorateRequest('principal');
  server.addHook('onRequest', (request, _reply, done) => {
    request.principal = { kind: 'owner' };
    done();
  });
  server.register(ownerScope, { application: options.application });
  return server;
}
