import type { Probe } from '../probe.ts';

export default {
  decision: 'P05',
  plants:
    'access.health gains a case whose expected status and body are a second read of the same GET, and a checkMatch whose pattern matches the empty string',
  gate: 'verify',
  rule: 'health read against itself: body is weak: its expected value is the same request read again',
  feature: 'access.health',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/feature-map/access.health.ts',
      old: '  cases: [\n',
      new: "  cases: [\n    defineCase({\n      name: 'health read against itself',\n      request: () => ({ method: 'GET', path: '/api/health', auth: 'none' }),\n      async expect({ response, session, check, checkMatch }) {\n        const again = await session.read({ method: 'GET', path: '/api/health', auth: 'none' });\n        check('status', again.status, response.status);\n        check('body', again.body, response.body);\n        checkMatch('content type', /(?:)/, response.headers['content-type']);\n      },\n    }),\n",
    },
  ],
} satisfies Probe;
