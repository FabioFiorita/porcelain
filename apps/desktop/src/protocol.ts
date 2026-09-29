import { z } from 'zod';

export const serverMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready'), address: z.url() }),
  z.object({ kind: z.literal('paired'), link: z.url() }),
  z.object({ kind: z.literal('failed'), message: z.string() }),
]);

export const hostMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pair') }),
  z.object({ kind: z.literal('stop') }),
]);
