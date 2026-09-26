import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a journey finds the commit button by a test id',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-locators)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { test } from '../kit/journey';\n\ntest('the workspace offers a commit button', async ({ pairedPage }) => {\n  await expect.element(pairedPage.getByTestId('commit-button')).toBeVisible();\n});\n",
    },
  ],
} satisfies Probe;
