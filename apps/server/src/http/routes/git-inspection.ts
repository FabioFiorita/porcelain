import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { readGitDiff } from './read-git-diff.ts';
import { readGitStatus } from './read-git-status.ts';

export async function gitInspectionRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  readGitStatus(server, options);
  readGitDiff(server, options);
}
