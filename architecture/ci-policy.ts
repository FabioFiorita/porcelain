import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  jobs: z.record(
    z.string(),
    z.object({
      strategy: z.object({ matrix: z.unknown() }).optional(),
      steps: z.array(z.object({ run: z.string().optional() })),
    }),
  ),
});
const probeRun = /^pnpm probes(?:\s|$)/;
const shardRun = /^pnpm probes --shard \$\{\{ matrix\.shard \}\}\/([1-9]\d*)$/;

export function manualAuditProblems(
  documents: ReadonlyMap<string, unknown>,
): string[] {
  const problems: string[] = [];
  const running = [...documents].flatMap(([path, document]) => {
    const parsed = workflowSchema.safeParse(document);
    if (!parsed.success) return [];
    const workflow = parsed.data;
    const triggers = Object.keys(workflow.on);
    const weeklySchedule = z
      .array(
        z
          .object({
            cron: z
              .string()
              .regex(/^(?:[0-5]?\d) (?:[01]?\d|2[0-3]) \* \* [0-6]$/),
          })
          .strict(),
      )
      .length(1);
    const isProbe = path.endsWith('/probes.yml');
    const allowed = isProbe
      ? ['workflow_dispatch', 'schedule']
      : ['workflow_dispatch'];
    if (
      (isProbe || path.endsWith('/web.yml')) &&
      (!triggers.includes('workflow_dispatch') ||
        triggers.some((trigger) => !allowed.includes(trigger)) ||
        (workflow.on.schedule !== undefined &&
          !weeklySchedule.safeParse(workflow.on.schedule).success))
    )
      problems.push(
        `${path}: expensive audits run on explicit workflow_dispatch${isProbe ? ' or one weekly schedule' : ''}, because routine pushes must not run the full audit.`,
      );
    return Object.entries(workflow.jobs).flatMap(([name, job]) => {
      const runs = job.steps.flatMap((step) =>
        step.run !== undefined && probeRun.test(step.run) ? [step.run] : [],
      );
      return runs.length > 0
        ? [{ where: `${path} job ${name}`, job, runs }]
        : [];
    });
  });
  const [only, ...others] = running;
  if (only === undefined || others.length > 0)
    return [
      ...problems,
      'Exactly one audit job runs the probe suite, so shards do not duplicate the audit.',
    ];
  const [run, ...extra] = only.runs;
  const count = Number(shardRun.exec(run ?? '')?.[1] ?? 0);
  const shards = Array.from({ length: count }, (_, index) => index + 1);
  if (
    count === 0 ||
    extra.length > 0 ||
    !isDeepStrictEqual(only.job.strategy?.matrix, { shard: shards })
  )
    problems.push(
      `${only.where}: the audit shards plant every probe exactly once, so no probe is silently omitted.`,
    );
  return problems;
}
