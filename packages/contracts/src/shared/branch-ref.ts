import { z } from 'zod';
import { GIT_REF_LENGTH } from './limits.ts';

export const branchRefSchema = z
  .string()
  .min(1)
  .max(GIT_REF_LENGTH)
  .regex(/^refs\/(?:heads|remotes)\/\S+$/u);
