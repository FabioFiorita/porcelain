import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'ports/check-worktree-use-case-port.ts gains a second method beside execute(input, context), so the use-case allowance carries a service in disguise',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/ports/check-worktree-use-case-port.ts',
      old: `  ): Promise<ListedWorktree>;
}`,
      new: `  ): Promise<ListedWorktree>;
  refresh(input: CheckWorktreeInput, context: OperationContext): Promise<void>;
}`,
    },
  ],
} satisfies Probe;
