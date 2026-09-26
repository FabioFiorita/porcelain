import type { Limits } from '../config/limits.ts';
import type { Logger } from '../ports/logger.ts';
import { ownerScope, type OwnerUseCases } from './scopes/owner.ts';
import { createServer } from './server-factory.ts';

export function createOwnerServer(options: {
  application: OwnerUseCases;
  logger: Logger;
  limits: Limits;
}) {
  const server = createServer({
    logger: options.logger,
    principal: { kind: 'owner' },
  });
  server.register(ownerScope, {
    application: options.application,
    limits: options.limits,
  });
  return server;
}
