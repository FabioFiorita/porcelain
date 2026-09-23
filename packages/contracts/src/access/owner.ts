import { z } from 'zod';

export const ownerStatusSchema = z.object({
  address: z.string(),
  dataDirectory: z.string(),
  pid: z.number().int().positive(),
});

export type OwnerStatusResponse = z.infer<typeof ownerStatusSchema>;
