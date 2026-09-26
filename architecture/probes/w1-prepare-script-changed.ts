import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'the prepare script stops installing the Lefthook pre-push, so pnpm install leaves no hook',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: '"prepare": "lefthook install --reset-hooks-path"',
      new: '"prepare": "true"',
    },
  ],
} satisfies Probe;
