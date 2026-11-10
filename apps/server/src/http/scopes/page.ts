import type { RequestBoundary } from '../server-factory.ts';
import { Layer } from 'effect';
import type { WebRootReader } from '../../ports/web-root-reader.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { requestPolicy } from '../hooks/request-policy.ts';
import { staticFiles } from '../static-files.ts';

export type PageUseCases = {
  access: RequestOriginOptions['access'];
};
export function pageScope(options: {
  boundary: RequestBoundary;
  application: PageUseCases;
  allowedHosts: readonly string[];
  files: WebRootReader;
}) {
  return staticFiles(options.files).pipe(
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
