import { defineCase, defineFeature, record } from '../scripts/feature.ts';

const health = () => ({ method: 'GET' as const, path: '/api/health' });

export default defineFeature({
  feature: 'reread',
  reaches: 'GET /api/health',
  paired: false,
  intent: 'observed',
  behaviour:
    'Assertions that compare the server with itself or with nothing: a status and a body checked against a second read of the same request, and a field matched by a pattern that matches the empty string. None says what the server answered. The run must judge every one weak.',
  cases: [
    defineCase({
      name: 'expected taken from the same request read again',
      request: health,
      async expect({ response, session, check }) {
        const again = await session.read(health());
        check('status', again.status, response.status);
        check('body', again.body, response.body);
      },
    }),
    defineCase({
      name: 'pattern that matches the empty string',
      request: health,
      expect({ response, checkMatch }) {
        checkMatch('status field', /(?:)/, record(response.body).status);
      },
    }),
  ],
});
