import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'a web helper calling the deprecated DOM execCommand method',
  gate: 'web-lint',
  rule: 'typescript(no-deprecated)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/shared/lib/probe-deprecated.ts',
      content:
        "export function probeDeprecated() {\n  return document.execCommand('copy');\n}\n",
    },
  ],
} satisfies Probe;
