import type { Logger } from '../ports/logger.ts';
import { ownerScope, type OwnerUseCases } from './scopes/owner.ts';
import { createServer } from './server-factory.ts';

export function createOwnerServer(options: {
  application: OwnerUseCases;
  logger: Logger;
}) {
  const server = createServer({
    logger: options.logger,
    principal: { kind: 'owner' },
  });
  server.register(ownerScope, { application: options.application });
  return server;
}
