import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { associateCommitReviewLayers } from './associate-commit-review-layers.ts';
import { getCommitReviewLayers } from './get-commit-review-layers.ts';
import { getReviewLayers } from './get-review-layers.ts';
import { replaceReviewLayers } from './replace-review-layers.ts';
export async function reviewLayerRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  getReviewLayers(server, options);
  getCommitReviewLayers(server, options);
  associateCommitReviewLayers(server, options);
  replaceReviewLayers(server, options);
}
