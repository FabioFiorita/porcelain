import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core redacts only the secrets the instance knows, so a pairing code typed with fill reaches the web evidence',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'verification-cli.integration.ts > the web CLI keeps a pairing code typed with fill or shown in a snapshot out of its evidence',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/verify-core/evidence.ts',
      old: '    recorder.harvestText(text);\n',
      new: '',
    },
  ],
} satisfies Probe;
