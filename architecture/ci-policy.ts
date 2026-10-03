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
    if (
      (path.endsWith('/web.yml') || path.endsWith('/probes.yml')) &&
      !isDeepStrictEqual(Object.keys(workflow.on), ['workflow_dispatch'])
    )
      problems.push(
        `${path}: expensive audits run only on explicit workflow_dispatch.`,
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
    return [...problems, 'Exactly one manual audit job runs the probe suite.'];
  const [run, ...extra] = only.runs;
  const count = Number(shardRun.exec(run ?? '')?.[1] ?? 0);
  const shards = Array.from({ length: count }, (_, index) => index + 1);
  if (
    count === 0 ||
    extra.length > 0 ||
    !isDeepStrictEqual(only.job.strategy?.matrix, { shard: shards })
  )
    problems.push(
      `${only.where}: the manual audit shards plant every probe exactly once.`,
    );
  return problems;
}
