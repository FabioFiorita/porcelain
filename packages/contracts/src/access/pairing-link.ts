import { z } from 'zod';

type PairingLinkParts = {
  addresses: string[];
  code: string;
  environmentId: string;
};

export function pairingLink(parts: PairingLinkParts): string {
  const fragment = [
    `c=${encodeURIComponent(parts.code)}`,
    `e=${encodeURIComponent(parts.environmentId)}`,
    ...(parts.addresses.length > 1
      ? [`a=${encodeURIComponent(parts.addresses.join(','))}`]
      : []),
  ].join('&');
  return `${parts.addresses[0] ?? ''}/pair#${fragment}`;
}

function linkParts(link: string): PairingLinkParts {
  const [origin = '', fragment = ''] = link.split('/pair#');
  const values = new Map(
    fragment.split('&').map((pair): [string, string] => {
      const [key = '', value = ''] = pair.split('=');
      return [key, decodeURIComponent(value)];
    }),
  );
  const addresses = values.get('a');
  return {
    addresses: addresses === undefined ? [origin] : addresses.split(','),
    code: values.get('c') ?? '',
    environmentId: values.get('e') ?? '',
  };
}

export const pairingLinkSchema = z.codec(
  z.string(),
  z.object({
    addresses: z.array(z.string()),
    code: z.string(),
    environmentId: z.string(),
  }),
  { decode: linkParts, encode: pairingLink },
);
