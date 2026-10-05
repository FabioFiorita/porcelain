import type { Limits } from '../config/limits.ts';
import type { Logger } from '../ports/logger.ts';
import { ownerScope, type OwnerUseCases } from './scopes/owner.ts';
import { createHttpListener, requestBoundary } from './server-factory.ts';

export function createOwnerServer(options: {
  application: OwnerUseCases;
  logger: Logger;
  limits: Limits;
}) {
  return createHttpListener({
    application: ownerScope({
      ...options,
      boundary: requestBoundary({
        logger: options.logger,
        principal: { kind: 'owner' },
        bodyBytes: options.limits.http.bodyBytes,
      }),
    }),
    logger: options.logger,
    principal: { kind: 'owner' },
    websocketMaxBytes: options.limits.liveUpdates.messageBytes,
  });
}
