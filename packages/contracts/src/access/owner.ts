import { z } from 'zod';

export const readOwnerStatusResponseSchema = z.object({
  address: z.string(),
  dataDirectory: z.string(),
  pid: z.number().int().positive(),
});

export type ReadOwnerStatusResponse = z.output<
  typeof readOwnerStatusResponseSchema
>;
