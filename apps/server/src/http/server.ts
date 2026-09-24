import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import websocket from '@fastify/websocket';
import type { Principal } from '@porcelain/contracts/access';
import Fastify from 'fastify';
import { FilesystemWebRootFiles } from '../adapters/web/filesystem-web-root-files.ts';
import type { ServerApplication } from '../bootstrap/compose-server.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Logger } from '../ports/logger.ts';
import { errorHandler } from './error-handler.ts';
import { callerOf } from './principal.ts';
import { apiScope } from './scopes/api.ts';
import { pageScope } from './scopes/page.ts';

declare module 'fastify' {
  interface FastifyRequest {
    disconnected: AbortSignal;
    principal: Principal | undefined;
    readonly caller: Principal;
  }
}

export type NetworkServerOptions = {
  application: ServerApplication;
  settings: Pick<ServerSettings, 'webRoot' | 'allowedHosts' | 'limits'>;
  logger: Logger;
};

export function createNetworkServer(options: NetworkServerOptions) {
  const { application, settings } = options;
  const { allowedHosts, webRoot } = settings;
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
    pingMs: settings.limits.liveUpdates.pingMs,
  });
  server.register(pageScope, {
    application,
    allowedHosts,
    files:
      webRoot === undefined ? undefined : new FilesystemWebRootFiles(webRoot),
  });
  return server;
}
