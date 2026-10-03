import type { Probe } from '../probe.ts';

export default {
  decision: 'P05',
  plants:
    'the health integration test gains a case whose expected body is a second read of the same GET, and a content type matched by a pattern that matches the empty string',
  gate: 'lint',
  rule: 'porcelain(spec-asserts)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/spec/integration/access-health.integration.ts',
      content: `
test('the health route answers the same way when read again', async ({ session }) => {
  const response = await session.send({ method: 'GET', path: '/api/health', auth: 'none' });
  const again = await session.send({ method: 'GET', path: '/api/health', auth: 'none' });
  expect(response.body).toStrictEqual(again.body);
  expect(response.headers['content-type']).toMatch(/(?:)/);
});
`,
    },
  ],
} satisfies Probe;
