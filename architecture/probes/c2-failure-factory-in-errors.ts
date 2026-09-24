import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'packages/files/src/errors/probe-failure-error.ts exports a problem-to-error factory function beside the error classes',
  gate: 'lint',
  rule: 'porcelain(failure-in-service)',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/src/errors/probe-failure-error.ts',
      content: `import { PathNotFoundError } from './path-not-found-error.ts';

export function probeFailureError(failure: 'missing'): Error {
  return failure === 'missing' ? new PathNotFoundError() : new PathNotFoundError();
}
`,
    },
  ],
} satisfies Probe;
