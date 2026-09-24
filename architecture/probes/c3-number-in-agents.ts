import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'agents claude.ts caps its output with its own MAX_OUTPUT_BYTES again instead of the limit the server passes in',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/agents/src/commit-planning/providers/claude.ts',
      old: 'maxBytes: this.limits.claudeOutputBytes,',
      new: 'maxBytes: 1024 * 1024,',
    },
  ],
} satisfies Probe;
