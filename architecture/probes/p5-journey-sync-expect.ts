import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey reads the server once and asserts it with a synchronous expect right after a click',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-retrying-assertions)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('a renamed project keeps its new name on the server', async ({ pairedPage, server }) => {\n  await pairedPage.getByRole('button', { name: 'Rename', exact: true }).click();\n  expect((await server.project()).name).toBe('Renamed');\n});\n",
    },
  ],
} satisfies Probe;
