const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const NULL_OIDS = new Set(['0'.repeat(40), '0'.repeat(64)]);

export function isOid(value: string): boolean {
  return OID.test(value);
}

export function isNullOid(value: string): boolean {
  return NULL_OIDS.has(value);
}

export function nullOidFor(oid: string): string {
  return oid.length === 64 ? '0'.repeat(64) : '0'.repeat(40);
}
