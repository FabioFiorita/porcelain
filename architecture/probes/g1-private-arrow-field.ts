import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: private arrow field `private readonly respond = (...) => ...` called inside the lane',
  gate: 'lint',
  rule: 'porcelain(operation-class-members)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: `        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };`,
      new: '        return this.respond(this.readEnvironment.execute().environmentId);',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: `      { callerSignal: context.signal },
    );
  }
}`,
      new: `      { callerSignal: context.signal },
    );
  }

  private readonly respond = (environmentId: string): ReadHealthResponse => ({
    status: 'ok',
    environmentId,
  });
}`,
    },
  ],
} satisfies Probe;
