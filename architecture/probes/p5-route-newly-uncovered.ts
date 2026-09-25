import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a new web api call to publish a review that no journey drives through the UI',
  gate: 'web-verify',
  rule: 'coverage: PUT /api/worktrees/:worktreeId/review: the web calls it',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/review/api/probe-live.ts',
      content:
        "import { requestJson } from '@/shared/api/request';\nimport { worktreePath } from './review-request';\n\nexport function probePublish(transport: typeof fetch, worktreeId: string) {\n  return requestJson(transport, `${worktreePath(worktreeId)}/review`, { parse: (value: unknown) => value }, { method: 'PUT' });\n}\n",
    },
  ],
} satisfies Probe;
