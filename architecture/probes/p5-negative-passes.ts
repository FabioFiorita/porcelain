import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the wrong-text negative journey waits for a heading the app does show, so it passes',
  gate: 'web-verify',
  feature: 'negative.wrong-text',
  rule: 'negative.wrong-text: the planted journey passed',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/negative/wrong-text.browser.ts',
      old: "      pairedPage.getByRole('heading', {\n        name: 'A heading Porcelain never shows',\n      }),",
      new: "      pairedPage.getByRole('region', {\n        name: 'Review content',\n      }),",
    },
  ],
} satisfies Probe;
