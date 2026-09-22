import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { listReviewedFiles } from './list-reviewed-files.ts';
import { removeReviewedFile } from './remove-reviewed-file.ts';
import { setReviewedFile } from './set-reviewed-file.ts';
import { setReviewedFiles } from './set-reviewed-files.ts';

export async function reviewedFileRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  listReviewedFiles(server, options);
  setReviewedFile(server, options);
  setReviewedFiles(server, options);
  removeReviewedFile(server, options);
}
