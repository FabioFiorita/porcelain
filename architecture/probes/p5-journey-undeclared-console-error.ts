import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the app shell journey passes while the page reports a console error it never declared',
  gate: 'web-verify',
  feature: 'app.shell',
  rule: 'met failures it did not declare through failures.console or failures.response: console error: A failure the journey never declared',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/browser/app-shell.browser.ts',
      old: '  unpairedPage,\n}) => {\n',
      new: "  unpairedPage,\n}) => {\n  console.error('A failure the journey never declared');\n",
    },
  ],
} satisfies Probe;
