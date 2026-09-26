import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey case named by its feature id instead of a sentence of behaviour',
  gate: 'web-lint',
  rule: 'porcelain(spec-behaviour-names)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('access.pairing: works', async ({ pairedPage }) => {\n  await expect.element(pairedPage.getByRole('region', { name: 'Review content' })).toBeVisible();\n});\n",
    },
  ],
} satisfies Probe;
