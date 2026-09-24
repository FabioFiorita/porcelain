import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import websocket from '@fastify/websocket';
import type { Principal } from '@porcelain/contracts/access';
import Fastify from 'fastify';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Logger } from '../ports/logger.ts';
import type { WebRootFiles } from '../ports/web-root-files.ts';
import { errorHandler } from './error-handler.ts';
import { callerOf } from './principal.ts';
import { apiScope, type ApiUseCases } from './scopes/api.ts';
import { pageScope, type PageUseCases } from './scopes/page.ts';

declare module 'fastify' {
  interface FastifyRequest {
    disconnected: AbortSignal;
    principal: Principal | undefined;
    readonly caller: Principal;
  }
}

export type NetworkServerOptions = {
  application: ApiUseCases & PageUseCases;
  settings: Pick<ServerSettings, 'allowedHosts' | 'limits'>;
  files: WebRootFiles;
  logger: Logger;
};

export function createNetworkServer(options: NetworkServerOptions) {
  const { application, settings } = options;
  const { allowedHosts } = settings;
  const server = Fastify().withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.setErrorHandler(errorHandler(options.logger));
  server.register(sensible);
  server.register(websocket, {
    options: { maxPayload: settings.limits.liveUpdates.messageBytes },
  });
  server.decorateRequest('disconnected');
  server.decorateRequest('principal');
  server.decorateRequest('caller', {
    getter() {
      return callerOf(this);
    },
  });
  server.addHook('onRequest', (request, reply, done) => {
    request.principal = undefined;
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
  server.register(apiScope, {
    prefix: '/api',
    application,
    allowedHosts,
  });
  server.register(pageScope, {
    application,
    allowedHosts,
    files: options.files,
  });
  return server;
}
