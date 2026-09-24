import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { Principal } from '@porcelain/contracts/access';
import Fastify from 'fastify';
import type { Logger } from '../ports/logger.ts';
import { errorHandler } from './error-handler.ts';
import { callerOf } from './principal.ts';

declare module 'fastify' {
  interface FastifyRequest {
    disconnected: AbortSignal;
    principal: Principal | undefined;
    readonly caller: Principal;
  }
}

export type ServerFactoryOptions = {
  logger: Logger;
  principal: Principal | undefined;
};

export function createServer(options: ServerFactoryOptions) {
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(errorHandler(options.logger));
  server.register(sensible);
  server.decorateRequest('disconnected');
  server.decorateRequest('principal');
  server.decorateRequest('caller', {
    getter() {
      return callerOf(this);
    },
  });
  server.addHook('onRequest', (request, reply, done) => {
    request.principal = options.principal;
    const controller = new AbortController();
    request.disconnected = controller.signal;
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded)
        controller.abort(
          new DOMException('The request was abandoned', 'AbortError'),
        );
    });
    done();
  });
  return server;
}
