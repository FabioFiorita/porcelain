import { z } from 'zod';

export const principalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('owner') }),
  z.object({ kind: z.literal('device'), deviceId: z.uuid() }),
]);

export type Principal = z.output<typeof principalSchema>;
