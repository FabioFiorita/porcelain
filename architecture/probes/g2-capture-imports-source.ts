import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants: 'the git capture script importing the status parser from src/',
  gate: 'lint',
  rule: 'porcelain(fixture-imports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/spec/fixtures/capture.ts',
      content: `import { parseGitStatus } from '../../src/inspection/parsers/parse-git-status.ts';
`,
    },
    {
      kind: 'append',
      path: 'packages/git/spec/fixtures/capture.ts',
      content: `parseGitStatus(Buffer.from(''));
`,
    },
  ],
} satisfies Probe;
