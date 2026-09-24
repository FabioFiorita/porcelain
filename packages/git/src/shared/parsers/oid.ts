const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const ZEROS = /^0+$/;

export function isOid(value: string): boolean {
  return OID.test(value);
}

export function isNullOid(value: string): boolean {
  return isOid(value) && ZEROS.test(value);
}

export function nullOidFor(oid: string): string {
  return '0'.repeat(oid.length);
}
