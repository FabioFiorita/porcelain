import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a feature api.ts calls fetch itself instead of the shared request function',
  gate: 'web-lint',
  rule: 'porcelain(web-transport-owner)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/access/api.ts',
      content:
        "\nexport function probeRead() {\n  return fetch('/api/probe');\n}\n",
    },
  ],
} satisfies Probe;
