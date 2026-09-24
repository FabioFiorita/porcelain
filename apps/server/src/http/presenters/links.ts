export type SummaryGrant = {
  token: string;
  expires: string;
  signature: string;
};

export type PairingLinkParts = {
  addresses: readonly string[];
  code: string;
  environmentId: string;
};

export function summaryLink(grant: SummaryGrant): string {
  const query = new URLSearchParams({
    expires: grant.expires,
    signature: grant.signature,
  });
  return `/review-summaries/${encodeURIComponent(grant.token)}?${query.toString()}`;
}

export function pairLink(parts: PairingLinkParts): string {
  const fragment = new URLSearchParams({
    c: parts.code,
    e: parts.environmentId,
  });
  if (parts.addresses.length > 1) fragment.set('a', parts.addresses.join(','));
  return `${parts.addresses[0] ?? ''}/pair#${fragment.toString()}`;
}
