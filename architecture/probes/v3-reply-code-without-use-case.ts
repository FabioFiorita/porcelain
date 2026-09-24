import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    'http/routes/access/clear-browser-session.ts: handler `reply.code(204).send()` without calling the use case',
  gate: 'lint',
  rule: 'porcelain(feature-route-handler)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/clear-browser-session.ts',
      old: `    async (request, reply) =>
      reply
        .code(204)
        .send(await options.useCase.execute({ signal: request.disconnected })),`,
      new: '    async (_request, reply) => reply.code(204).send(),',
    },
  ],
} satisfies Probe;
