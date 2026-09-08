import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { getReviewLayers } from './get-review-layers.ts';
import { replaceReviewLayers } from './replace-review-layers.ts';
export async function reviewLayerRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  getReviewLayers(server, options);
  replaceReviewLayers(server, options);
}
