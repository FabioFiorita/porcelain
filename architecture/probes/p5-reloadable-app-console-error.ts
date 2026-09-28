import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the app reports a console error while it boots inside the frame the kit reloads',
  gate: 'web-verify',
  feature: 'reviews.reload-layout',
  rule: 'met failures it did not declare through failures.console or failures.response: console error: A failure the reloaded app never declared',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/main.tsx',
      content: "console.error('A failure the reloaded app never declared');\n",
    },
  ],
} satisfies Probe;
