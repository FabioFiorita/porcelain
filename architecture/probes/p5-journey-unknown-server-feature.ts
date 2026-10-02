import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a feature map lists an API route the server does not register',
  gate: 'features',
  rule: '.agents/skills/web-verify/features/projects.rename.md: api PATCH /api/projects/:projectId/title is no route the server registers',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/features/projects.rename.md',
      old: '  - PATCH /api/projects/:projectId\n',
      new: '  - PATCH /api/projects/:projectId/title\n',
    },
  ],
} satisfies Probe;
