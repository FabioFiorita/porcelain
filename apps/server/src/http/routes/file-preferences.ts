import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { listFilePreferences } from './list-file-preferences.ts';
import { setFilePreference } from './set-file-preference.ts';

export async function filePreferenceRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  listFilePreferences(server, options);
  setFilePreference(server, options);
}
