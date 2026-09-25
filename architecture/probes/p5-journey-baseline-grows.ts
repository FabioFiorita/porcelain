import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a covered route written back into the list of routes no journey reaches',
  gate: 'web-lint',
  rule: 'style(web-journey-baseline)',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-journey-baseline.json',
      old: '[]',
      new: '["PATCH /api/projects/:projectId"]',
    },
  ],
} satisfies Probe;
