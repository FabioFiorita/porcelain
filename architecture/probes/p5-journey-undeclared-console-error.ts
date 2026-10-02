import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the app shell e2e test passes while the page reports a console error it never declared',
  gate: 'web-verify',
  feature: 'apps/web/spec/e2e/app-shell.e2e.ts',
  rule: 'met failures it did not declare through failures.console or failures.response: console error: A failure the journey never declared',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/e2e/app-shell.e2e.ts',
      old: '  unpairedPage,\n}) => {\n',
      new: "  unpairedPage,\n}) => {\n  await unpairedPage.evaluate(() => console.error('A failure the journey never declared'));\n",
    },
  ],
} satisfies Probe;
