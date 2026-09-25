import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey imports a feature query from src instead of driving the app through the kit',
  gate: 'web-lint',
  rule: 'porcelain(web-journey-imports)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { expect } from 'vitest';\nimport { isContentChangedError } from '../../src/features/review/queries/review';\nimport { test } from '../kit/journey';\n\ntest('a conflict is recognised by the review client', async ({ server }) => {\n  await expect.poll(async () => isContentChangedError(await server.health())).toBe(false);\n});\n",
    },
  ],
} satisfies Probe;
