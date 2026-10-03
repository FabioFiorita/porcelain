import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core keeps one instance registry for every checkout, so a command in one worktree stops the instance another worktree started',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'verification-cli.integration.ts > each checkout sees only the instances it started',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/core/registry.ts',
      old: '.update(repositoryRoot)',
      new: ".update('every checkout')",
    },
  ],
} satisfies Probe;
