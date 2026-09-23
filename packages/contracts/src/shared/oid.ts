import { z } from 'zod';

const OID = '(?:[0-9a-f]{40}|[0-9a-f]{64})';

export const oidSchema = z.string().regex(new RegExp(`^${OID}$`));
export const oidListSchema = z
  .string()
  .regex(new RegExp(`^${OID}(?:,${OID})*$`));

export type Oid = z.output<typeof oidSchema>;
export type OidList = z.output<typeof oidListSchema>;
