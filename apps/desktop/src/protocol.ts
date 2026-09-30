import { z } from 'zod';

export const serverMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready'), address: z.url() }),
  z.object({ kind: z.literal('failed'), message: z.string() }),
]);

export const hostMessage = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('start'),
    profile: z.string(),
    projectHome: z.string(),
    packageRoot: z.string(),
    session: z.object({ deviceId: z.string(), secretHash: z.string() }),
  }),
  z.object({ kind: z.literal('stop') }),
]);
