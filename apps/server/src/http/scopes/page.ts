import type { RequestBoundary } from '../server-factory.ts';
import { Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import type { WebRootReader } from '../../ports/web-root-reader.ts';
import type { HttpApplication } from '../application.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { requestPolicy } from '../hooks/request-policy.ts';
import { summaryPageHeaders } from '../hooks/summary-page-headers.ts';
import { staticFiles } from '../static-files.ts';

export type PageUseCases = {
  access: RequestOriginOptions['access'];
  reviewPages: HttpApplication;
};
export function pageScope(options: {
  boundary: RequestBoundary;
  application: PageUseCases;
  allowedHosts: readonly string[];
  files: WebRootReader;
}) {
  return Layer.mergeAll(
    options.application.reviewPages.pipe(
      Layer.provide(HttpRouter.middleware(summaryPageHeaders).layer),
    ),
    staticFiles(options.files),
  ).pipe(
    Layer.provide(
      requestPolicy(
        checkRequestOrigin(
          {
            access: options.application.access,
            allowedHosts: options.allowedHosts,
          },
          { crossOrigin: 'refused' },
        ),
      ).combine(options.boundary).layer,
    ),
  );
}
