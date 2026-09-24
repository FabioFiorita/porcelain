import websocket from '@fastify/websocket';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Logger } from '../ports/logger.ts';
import type { WebRootReader } from '../ports/web-root-reader.ts';
import { apiScope, type ApiUseCases } from './scopes/api.ts';
import { pageScope, type PageUseCases } from './scopes/page.ts';
import { createServer } from './server-factory.ts';

type NetworkServerOptions = {
  application: ApiUseCases & PageUseCases;
  settings: Pick<ServerSettings, 'allowedHosts' | 'limits'>;
  files: WebRootReader;
  logger: Logger;
};

export function createNetworkServer(options: NetworkServerOptions) {
  const { application, settings } = options;
  const { allowedHosts } = settings;
  const server = createServer({ logger: options.logger, principal: undefined });
  server.register(websocket, {
    options: { maxPayload: settings.limits.liveUpdates.messageBytes },
  });
  server.register(apiScope, {
    prefix: '/api',
    application,
    allowedHosts,
    limits: settings.limits,
  });
  server.register(pageScope, {
    application,
    allowedHosts,
    files: options.files,
  });
  return server;
}
