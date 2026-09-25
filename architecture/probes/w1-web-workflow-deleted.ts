import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the web workflow deleted, so CI runs no web gate',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [{ kind: 'delete', path: '.github/workflows/web.yml' }],
} satisfies Probe;
