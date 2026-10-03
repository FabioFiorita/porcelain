import { z } from 'zod';

const principalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('owner') }),
  z.object({ kind: z.literal('device'), deviceId: z.uuid() }),
]);

export type Principal = z.output<typeof principalSchema>;

export const readSessionResponseSchema = principalSchema;

export type ReadSessionRequest = { viewer: Principal };
export type ReadSessionResponse = z.output<typeof readSessionResponseSchema>;
