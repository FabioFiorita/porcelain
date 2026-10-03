import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the isolated server starts with the fake coding tool already on its PATH, so no case can show the refusal for a tool that is not installed',
  gate: 'integration',
  rule: 'git-actions-generate-commit-draft.integration.ts > drafting a commit with a coding tool that is not installed is refused',
  feature: 'git-actions-generate-commit-draft',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/spec/kit/sandbox.ts',
      old: "    await symlink(git, join(bin, 'git'));\n",
      new: "    await symlink(git, join(bin, 'git'));\n    await symlink(codingToolExecutable, join(bin, 'claude'));\n",
    },
  ],
} satisfies Probe;
