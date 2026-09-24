import type { FastifyInstance } from 'fastify';
import type { WebRootFiles } from '../../ports/web-root-files.ts';
import type { ReadReviewSummaryUseCase } from '../../use-cases/reviews/read-review-summary.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { readReviewSummaryPage } from '../routes/reviews/read-review-summary-page.ts';
import { staticFiles } from '../static-files.ts';

export type PageUseCases = {
  access: RequestOriginOptions['access'];
  reviews: { readReviewSummary: Pick<ReadReviewSummaryUseCase, 'execute'> };
};

export async function pageScope(
  server: FastifyInstance,
  options: {
    application: PageUseCases;
    allowedHosts: readonly string[];
    files: WebRootFiles;
  },
) {
  const { application, allowedHosts, files } = options;
  server.addHook(
    'onRequest',
    checkRequestOrigin({ access: application.access, allowedHosts }),
  );
  server.register(readReviewSummaryPage, {
    useCase: application.reviews.readReviewSummary,
  });
  server.register(staticFiles, { files });
}
