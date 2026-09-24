import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    'scripts/probe-reach.ts importing a projects rule by a path into packages/',
  gate: 'lint',
  rule: 'porcelain(root-scripts-import-no-package)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-reach.ts',
      content: `import { deriveProjectName } from '../packages/projects/src/rules/derive-project-name.ts';

process.stdout.write(\`\${deriveProjectName(undefined, '/tmp/probe')}\\n\`);
`,
    },
  ],
} satisfies Probe;
