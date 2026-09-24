import { z } from 'zod';
import type { CommitProposalGroup } from '../dtos/commit-proposal-group.ts';
import { CommitPlanFailedError } from '../errors/commit-plan-failed-error.ts';

const commitPlanSchema = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        message: z.string().min(1).max(16_384),
        paths: z.array(z.string().min(1).max(4096)).min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

export const commitPlanOutputSchema = JSON.stringify(
  z.toJSONSchema(commitPlanSchema, { target: 'draft-7' }),
);

export function parseCommitPlan(answer: unknown): CommitProposalGroup[] {
  const parsed = commitPlanSchema.safeParse(answer);
  if (!parsed.success) throw new CommitPlanFailedError({ cause: parsed.error });
  return parsed.data.groups;
}
