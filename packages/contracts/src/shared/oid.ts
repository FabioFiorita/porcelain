import { Schema } from 'effect';

const OID = '(?:[0-9a-f]{40}|[0-9a-f]{64})';

export const oidSchema = Schema.String.check(
  Schema.isPattern(new RegExp(`^${OID}$`)),
);
export const oidListSchema = Schema.String.check(
  Schema.isPattern(new RegExp(`^${OID}(?:,${OID})*$`)),
);
