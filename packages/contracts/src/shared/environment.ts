import { z } from 'zod';

export const environmentSchema = z.object({
  name: z.string(),
  custom: z.boolean(),
});
