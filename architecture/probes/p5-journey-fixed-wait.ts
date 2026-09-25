import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a journey sleeps half a second before it looks for the result',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-no-waits)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('the commit dialog opens after a click', async ({ pairedPage }) => {\n  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();\n  await new Promise((done) => setTimeout(done, 500));\n  await expect.element(pairedPage.getByRole('dialog')).toBeVisible();\n});\n",
    },
  ],
} satisfies Probe;
