import type { Probe } from '../probe.ts';

export default {
  decision: 'X3',
  plants:
    "use-cases/projects/probe-env.ts reading a file through process.getBuiltinModule('node:fs') and process.env.HOME",
  gate: 'lint',
  rule: 'porcelain(no-node-globals)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/use-cases/projects/probe-env.ts',
      content: `import type { OperationContext } from '../../ports/operation-context.ts';

export class ProbeEnvUseCase {
  async execute(context: OperationContext): Promise<string> {
    const fs = process.getBuiltinModule('node:fs');
    return fs.readFileSync(\`\${process.env.HOME ?? ''}/.gitconfig\`, 'utf8');
  }
}
`,
    },
  ],
} satisfies Probe;
