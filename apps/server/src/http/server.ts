import { Effect, Layer, type Context } from 'effect';
import type { Observability } from '../runtime/observability.ts';
import { HttpRouter } from 'effect/http';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Logger } from '../ports/logger.ts';
import type { WebRootReader } from '../ports/web-root-reader.ts';
import {
  identifyRequestClient,
  type RequestClientOptions,
} from './hooks/request-client.ts';
import { apiScope, type ApiUseCases } from './scopes/api.ts';
import { pageScope, type PageUseCases } from './scopes/page.ts';
import { createHttpListener, requestBoundary } from './server-factory.ts';

export function createNetworkServer(options: {
  application: ApiUseCases & PageUseCases & RequestClientOptions;
  settings: Pick<ServerSettings, 'allowedHosts' | 'limits'>;
  files: WebRootReader;
  logger: Logger;
  observability: Context.Service.Shape<typeof Observability>;
}) {
  const { application, settings } = options;
  const boundary = HttpRouter.middleware((app) =>
    identifyRequestClient(application, {
      maxAgeSeconds:
        settings.limits.access.remoteAccess.strictTransportMaxAgeSeconds,
    }).pipe(Effect.andThen(app)),
  ).combine(
    requestBoundary({
      logger: options.logger,
      observability: options.observability,
      principal: undefined,
      bodyBytes: settings.limits.http.bodyBytes,
    }),
  );
  const routes = Layer.mergeAll(
    apiScope({
      application,
      allowedHosts: settings.allowedHosts,
      limits: settings.limits,
      boundary,
    }),
    pageScope({
      application,
      allowedHosts: settings.allowedHosts,
      files: options.files,
      boundary,
    }),
  );
  return createHttpListener({
    application: routes,
    logger: options.logger,
    principal: undefined,
    websocketMaxBytes: settings.limits.liveUpdates.messageBytes,
    closeGrace: settings.limits.listeners.closeGrace,
  });
}
