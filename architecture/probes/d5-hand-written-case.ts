import type { Probe } from '../probe.ts';

export default {
  decision: 'P16',
  plants:
    'projects.rename gains a hand-written case: its PATCH carries a header Node refuses before sending, and its assertions are on GET /api/health',
  gate: 'verify',
  rule: 'catalogue: projects.rename.ts builds every case with defineCase',
  feature: 'projects.rename',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/feature-map/projects.rename.ts',
      old: "  cases: [\n    defineCase({\n      name: 'existing project',",
      new: "  cases: [\n    {\n      name: 'renames through a request that never leaves',\n      async run(session, runner) {\n        runner.enter('request');\n        await session\n          .send({\n            method: 'PATCH',\n            path: `/api/projects/${session.projectId}`,\n            headers: { 'x-probe': 'bad\\nvalue' },\n            body: { name: 'New name' },\n          })\n          .catch(() => undefined);\n        runner.enter('follow-up');\n        const health = await session.read({ method: 'GET', path: '/api/health' });\n        runner.checks.check('status', 200, health.status);\n        runner.checks.check('body status', 'ok', record(health.body).status);\n      },\n    },\n    defineCase({\n      name: 'existing project',",
    },
  ],
} satisfies Probe;
