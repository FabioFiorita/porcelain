import type { FastifyInstance } from 'fastify';
import type { WebRootReader } from '../../ports/web-root-reader.ts';
import { mountEffectRoutes, type EffectRoutes } from '../effect-bridge.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { summaryPageHeaders } from '../hooks/summary-page-headers.ts';
import { staticFiles } from '../static-files.ts';

export type PageUseCases = {
  access: RequestOriginOptions['access'];
  reviewPages: EffectRoutes;
};

export async function pageScope(
  server: FastifyInstance,
  options: {
    application: PageUseCases;
    allowedHosts: readonly string[];
    files: WebRootReader;
  },
) {
  const { application, allowedHosts, files } = options;
  server.addHook(
    'onRequest',
    checkRequestOrigin(
      { access: application.access, allowedHosts },
      { crossOrigin: 'refused' },
    ),
  );
  server.register(async (summaries) => {
    summaries.addHook('onRequest', summaryPageHeaders);
    summaries.register(mountEffectRoutes, { routes: application.reviewPages });
  });
  server.register(staticFiles, { files });
}
