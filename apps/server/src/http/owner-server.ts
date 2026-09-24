import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import type { Logger } from '../ports/logger.ts';
import { errorHandler } from './error-handler.ts';
import { callerOf } from './principal.ts';
import { ownerScope, type OwnerUseCases } from './scopes/owner.ts';

export function createOwnerServer(options: {
  application: OwnerUseCases;
  logger: Logger;
}) {
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(errorHandler(options.logger));
  server.register(sensible);
  server.decorateRequest('principal');
  server.decorateRequest('caller', {
    getter() {
      return callerOf(this);
    },
  });
  server.addHook('onRequest', (request, _reply, done) => {
    request.principal = { kind: 'owner' };
    done();
  });
  server.register(ownerScope, { application: options.application });
  return server;
}
