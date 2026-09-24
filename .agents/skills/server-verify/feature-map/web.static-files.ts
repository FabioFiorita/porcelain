import {
  apiError,
  defineCase,
  defineFeature,
  type HttpRequest,
} from '../scripts/feature.ts';

const notFound = apiError(404, 'Not Found', 'Not Found');
const page = (path: string): HttpRequest => ({
  method: 'GET',
  path,
  auth: 'none',
});

export default defineFeature({
  feature: 'web.static-files',
  reaches: 'GET /*',
  paired: false,
  intent: 'observed',
  behaviour:
    'The network listener serves the built web app from its web root without a credential. The root and any path without a file extension outside /assets and /api answer the web shell, so client routes load the app; a file is served with its media type. Hashed assets are cached for good and everything else is revalidated. A missing file, a path under /api, a path that climbs out of the web root and a symbolic link that leads out of it are not found. HEAD answers the headers without a body.',
  cases: [
    defineCase({
      name: 'the web shell at the root',
      request: () => [page('/'), { ...page('/'), method: 'HEAD' }],
      expect({ responses, session, check }) {
        const [get, head] = responses;
        check('status', 200, get?.status);
        check('the shell', session.fixture.web.shell, get?.body);
        check(
          'media type',
          'text/html; charset=utf-8',
          get?.headers['content-type'],
        );
        check('revalidated', 'no-cache', get?.headers['cache-control']);
        check('HEAD status', 200, head?.status);
        check('HEAD has no body', undefined, head?.body);
        check(
          'HEAD announces the length',
          String(Buffer.byteLength(session.fixture.web.shell)),
          head?.headers['content-length'],
        );
      },
    }),
    defineCase({
      name: 'a hashed asset',
      request: (session) => page(`/${session.fixture.web.asset.path}`),
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check('the asset', session.fixture.web.asset.text, response.body);
        check(
          'media type',
          'text/javascript; charset=utf-8',
          response.headers['content-type'],
        );
        check(
          'cached for good',
          'public, max-age=31536000, immutable',
          response.headers['cache-control'],
        );
      },
    }),
    defineCase({
      name: 'a client route answers the shell',
      request: () => page('/projects/any/worktrees/route'),
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check('the shell', session.fixture.web.shell, response.body);
        check('revalidated', 'no-cache', response.headers['cache-control']);
      },
    }),
    defineCase({
      name: 'a missing file or a path under /api',
      request: () => [
        page('/assets/missing-12345678.js'),
        page('/robots.txt'),
        page('/api/unknown'),
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 404, response.status);
          check(`request ${index + 1} error body`, notFound, response.body);
        }
      },
    }),
    defineCase({
      name: 'a path or a symbolic link that leads out of the web root',
      request: (session) => [
        page('/%2e%2e/credential.json'),
        page('/..%2fcredential.json'),
        page(`/${session.fixture.web.escape}`),
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 404, response.status);
          check(`request ${index + 1} error body`, notFound, response.body);
        }
      },
    }),
  ],
});
