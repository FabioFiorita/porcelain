import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a journey case that clicks through the app and asserts nothing',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-asserts)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { test } from '../kit/journey';\n\ntest('opening the commit dialog shows its form', async ({ pairedPage }) => {\n  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();\n});\n",
    },
  ],
} satisfies Probe;
