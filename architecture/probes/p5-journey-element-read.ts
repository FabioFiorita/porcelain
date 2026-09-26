import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey reads an element once with .element() and asserts on the node it got',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-locators)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('the workspace names its review region', async ({ pairedPage }) => {\n  const region = pairedPage.getByRole('region', { name: 'Review content' }).element();\n  await expect.element(region).toBeVisible();\n});\n",
    },
  ],
} satisfies Probe;
