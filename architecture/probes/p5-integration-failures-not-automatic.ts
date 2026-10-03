import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the integration failures fixture stops being automatic, so a test that never asks for it meets no failure verdict',
  gate: 'web-verify',
  feature: 'apps/web/spec/integration/protections.test.tsx',
  rule: 'Error: The automatic failures fixture watches every test; none is running.',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/integration/fixtures.tsx',
      old: "    'failures',\n    { auto: true },\n",
      new: "    'failures',\n    { auto: false },\n",
    },
  ],
} satisfies Probe;
