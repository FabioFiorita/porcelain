import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a journey case that asks Vitest to retry it twice',
  gate: 'web-lint',
  rule: 'porcelain(web-browser-spec-no-skips)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('the workspace opens after pairing', { retry: 2 }, async ({ pairedPage }) => {\n  await expect.element(pairedPage.getByRole('region', { name: 'Review content' })).toBeVisible();\n});\n",
    },
  ],
} satisfies Probe;
