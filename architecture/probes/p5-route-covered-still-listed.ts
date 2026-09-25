import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the rename route listed as uncovered although the projects.rename journey reaches it',
  gate: 'web-verify',
  rule: 'coverage: PATCH /api/projects/:projectId: a journey now reaches it through the UI',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-journey-baseline.json',
      old: '[',
      new: '["PATCH /api/projects/:projectId",',
    },
  ],
} satisfies Probe;
