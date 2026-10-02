import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the project rename integration test passes while the feature reports a console error it never declared',
  gate: 'web-verify',
  feature: 'apps/web/spec/integration/projects-rename.test.tsx',
  rule: 'met failures it did not declare through failures.console or failures.response: console error: A failure the feature never declared',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/integration/projects-rename.test.tsx',
      old: "  const name = 'Browser renamed project';\n",
      new: "  const name = 'Browser renamed project';\n  console.error('A failure the feature never declared');\n",
    },
  ],
} satisfies Probe;
