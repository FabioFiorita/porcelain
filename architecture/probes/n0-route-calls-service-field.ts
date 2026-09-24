import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'http/routes/access/read-health.ts: option renamed service and handler calls options.service.execute()',
  gate: 'lint',
  rule: 'porcelain(feature-route-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: "options: { useCase: Pick<ReadHealthUseCase, 'execute'> }",
      new: "options: { service: Pick<ReadHealthUseCase, 'execute'> }",
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: 'options.useCase.execute({ signal: request.disconnected })',
      new: 'options.service.execute({ signal: request.disconnected })',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/scopes/public.ts',
      old: `  server.register(readHealth, {
    useCase: application.access.readHealth,`,
      new: `  server.register(readHealth, {
    service: application.access.readHealth,`,
    },
  ],
} satisfies Probe;
