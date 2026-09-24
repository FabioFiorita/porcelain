import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'changes read-change-lines-service.ts makes its failure(problem) public so callers can map problems too',
  gate: 'lint',
  rule: 'porcelain(failure-in-service)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/changes/src/services/read-change-lines-service.ts',
      old: '  private failure(problem: LineRangeProblem): Error {',
      new: '  failure(problem: LineRangeProblem): Error {',
    },
  ],
} satisfies Probe;
