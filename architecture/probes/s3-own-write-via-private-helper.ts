import type { Probe } from '../probe.ts';

export default {
  decision: 'S3',
  plants:
    "use-cases/projects/set-file-preference.ts: a 'read' lane calls a private helper that calls this.setFilePreference.execute",
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/set-file-preference.ts',
      old: `      'write',
      async () => this.setFilePreference.execute(input),`,
      new: `      'read',
      async () => this.save(input),`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/set-file-preference.ts',
      old: `    return { preferences: result.preferences };
  }
}`,
      new: `    return { preferences: result.preferences };
  }

  private save(input: SetFilePreferenceParams & SetFilePreferenceRequest) {
    return this.setFilePreference.execute(input);
  }
}`,
    },
  ],
} satisfies Probe;
