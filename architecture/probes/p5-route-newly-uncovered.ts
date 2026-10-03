import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a new web api call to publish a review that no feature map lists',
  gate: 'features',
  rule: 'the web calls PUT /api/worktrees/:param/review: no map file lists it in its api',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/reviews/api.ts',
      content:
        "\nexport function probePublish(transport: typeof fetch, worktreeId: string) {\n  return requestJson(transport, `${worktreePath(worktreeId)}/review`, { parse: (value: unknown) => value }, { method: 'PUT' });\n}\n",
    },
  ],
} satisfies Probe;
