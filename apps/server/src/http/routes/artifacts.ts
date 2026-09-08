import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { InvalidArtifactError } from '../../use-cases/errors/invalid-artifact-error.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { deleteArtifact } from './delete-artifact.ts';
import { getArtifact } from './get-artifact.ts';
import { listArtifacts } from './list-artifacts.ts';
import { uploadArtifact } from './upload-artifact.ts';

export async function artifactRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  server.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  // Decode strictly before JSON parsing; the default parser would replace invalid UTF-8 bytes.
  server.removeContentTypeParser('application/json');
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      try {
        done(
          null,
          JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(body as Buffer),
          ),
        );
      } catch {
        done(new InvalidArtifactError());
      }
    },
  );
  uploadArtifact(server, options);
  listArtifacts(server, options);
  getArtifact(server, options);
  deleteArtifact(server, options);
}
