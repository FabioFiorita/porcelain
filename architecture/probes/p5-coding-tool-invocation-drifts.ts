import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the server asks the Claude CLI for streamed JSON, which the CLI would not answer with the envelope the server parses',
  gate: 'verify',
  rule: 'a message drafted for the selected change: status',
  feature: 'git-actions.generate-commit-draft',
  edits: [
    {
      kind: 'replace',
      path: 'packages/agents/src/commit-planning/claude-provider.ts',
      old: "            '--output-format',\n            'json',\n",
      new: "            '--output-format',\n            'stream-json',\n",
    },
  ],
} satisfies Probe;
