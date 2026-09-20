import { z } from 'zod';

/**
 * The environment id is public on purpose. A pairing link carries the id of the
 * installation it was made for, and the browser compares the two *before*
 * sending the code — the alternative is handing a live code to whatever server
 * answered, to discover it does not belong there.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  environmentId: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
