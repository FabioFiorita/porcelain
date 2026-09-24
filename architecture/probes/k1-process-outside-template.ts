import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'new packages/process/src/utils/format-command.ts: a folder the infrastructure template does not name',
  gate: 'arch',
  rule: 'infrastructure-layout:',
  edits: [
    {
      kind: 'create',
      path: 'packages/process/src/utils/format-command.ts',
      content: `export function formatCommand(command: string): string {
  return command.trim();
}
`,
    },
  ],
} satisfies Probe;
