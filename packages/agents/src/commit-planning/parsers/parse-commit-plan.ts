import { z } from 'zod';
import type { CommitPlanLimits } from '../dtos/agent-limits.ts';
import type { CommitProposalGroup } from '../dtos/commit-proposal-group.ts';
import { CommitPlanFailedError } from '../errors/commit-plan-failed-error.ts';

export type CommitPlanParser = {
  outputSchema: string;
  parse: (answer: unknown) => CommitProposalGroup[];
};

export function commitPlanParser(limits: CommitPlanLimits): CommitPlanParser {
  const schema = z.strictObject({
    groups: z
      .array(
        z.strictObject({
          message: z.string().min(1).max(limits.maxMessageLength),
          paths: z
            .array(z.string().min(1).max(limits.maxPathLength))
            .min(1)
            .max(limits.maxPaths),
        }),
      )
      .min(1)
      .max(limits.maxGroups),
  });
  return {
    outputSchema: JSON.stringify(z.toJSONSchema(schema, { target: 'draft-7' })),
    parse: (answer) => {
      const parsed = schema.safeParse(answer);
      if (!parsed.success)
        throw new CommitPlanFailedError({ cause: parsed.error });
      return parsed.data.groups;
    },
  };
}
