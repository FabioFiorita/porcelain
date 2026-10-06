import { Schema, SchemaTransformation } from 'effect';

type PairingLinkParts = {
  addresses: readonly string[];
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

const pairingLinkWireSchema = Schema.String;
const pairingLinkValueSchema = Schema.Struct({
  addresses: Schema.Array(Schema.String),
  code: Schema.String,
  environmentId: Schema.String,
});
export const pairingLinkSchema = pairingLinkWireSchema.pipe(
  Schema.decodeTo(
    pairingLinkValueSchema,
    SchemaTransformation.transform<
      typeof pairingLinkValueSchema.Type,
      typeof pairingLinkWireSchema.Type
    >({ decode: linkParts, encode: pairingLink }),
  ),
);
