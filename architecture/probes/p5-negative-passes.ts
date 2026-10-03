import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the wrong-text protection test waits for a heading the app does show, so the failing assertion it proves never fails',
  gate: 'web-verify',
  feature: 'apps/web/spec/e2e/protections.e2e.ts',
  rule: 'Error: expect(received).rejects.toThrow()',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/e2e/protections.e2e.ts',
      old: "        name: 'A heading Porcelain never shows',\n",
      new: "        name: 'This browser is not paired',\n",
    },
  ],
} satisfies Probe;
