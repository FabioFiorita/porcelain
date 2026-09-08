import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { getInventoryRoute } from './get-inventory.ts';
import { refreshInventoryRoute } from './refresh-inventory.ts';
import { registerProjectRoute } from './register-project.ts';
import { removeProject } from './remove-project.ts';

export async function inventoryRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  server.register(getInventoryRoute, { application: options.application });
  server.register(removeProject, { application: options.application });
  server.register(registerProjectRoute, { application: options.application });
  server.register(refreshInventoryRoute, { application: options.application });
}
