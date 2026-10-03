import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core leaves its own files out of the build fingerprint, so an instance keeps running under CLI code that changed since start',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'verification-cli.integration.ts > a CLI command refuses to drive an instance once the CLI code changed since start',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/core/registry.ts',
      old: '      dirname(this.cli),\n      core,\n',
      new: '',
    },
  ],
} satisfies Probe;
