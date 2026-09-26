import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey fetches /api/inventory itself instead of reading the server through the kit',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-through-kit)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('the paired browser can read its inventory', async ({ pairedPage }) => {\n  await expect.element(pairedPage.getByRole('region', { name: 'Review content' })).toBeVisible();\n  await expect.poll(async () => (await fetch('/api/inventory')).status).toBe(200);\n});\n",
    },
  ],
} satisfies Probe;
