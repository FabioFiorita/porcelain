import { z } from 'zod';

export const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

export type Fingerprint = z.output<typeof fingerprintSchema>;
