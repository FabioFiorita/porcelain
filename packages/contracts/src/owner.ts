import { z } from 'zod';

/** What `porcelain status` reads from the owner socket. */
export const ownerStatusSchema = z.object({
  address: z.string(),
  dataDirectory: z.string(),
  pid: z.number().int().positive(),
});

export type OwnerStatusResponse = z.infer<typeof ownerStatusSchema>;
