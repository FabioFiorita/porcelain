import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'process index.ts re-exports runCommand under a second name that nothing imports from the index',
  gate: 'arch',
  rule: 'unused-export',
  edits: [
    {
      kind: 'append',
      path: 'packages/process/src/index.ts',
      content: `export { runCommand as probeRunCommand } from './commands/run-command.ts';
`,
    },
  ],
} satisfies Probe;
