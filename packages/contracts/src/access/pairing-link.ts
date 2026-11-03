import { Effect, Schema, SchemaIssue, SchemaTransformation } from 'effect';

type PairingLinkParts = {
  addresses: readonly string[];
  code: string;
  environmentId: string;
  appOrigin?: string | undefined;
};

export const APP_PAIRING_PATH = '/open/pair';
const PAGE_PATH = '/pair';

export function isAppPairingPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '') === APP_PAIRING_PATH;
}

export function pairingLink(parts: PairingLinkParts): string {
  const fragment = (withAddresses: boolean) =>
    [
      `c=${encodeURIComponent(parts.code)}`,
      `e=${encodeURIComponent(parts.environmentId)}`,
      ...(withAddresses
        ? [`a=${encodeURIComponent(parts.addresses.join(','))}`]
        : []),
    ].join('&');
  return parts.appOrigin === undefined
    ? `${parts.addresses[0] ?? ''}${PAGE_PATH}#${fragment(parts.addresses.length > 1)}`
    : `${parts.appOrigin}${APP_PAIRING_PATH}#${fragment(true)}`;
}

function linkParts(link: string): PairingLinkParts | undefined {
  const hash = link.indexOf('#');
  if (hash === -1) return undefined;
  const base = link.slice(0, hash);
  let values: Map<string, string>;
  try {
    values = new Map(
      link
        .slice(hash + 1)
        .split('&')
        .map((pair): [string, string] => {
          const [key = '', value = ''] = pair.split('=');
          return [key, decodeURIComponent(value)];
        }),
    );
  } catch {
    return undefined;
  }
  const listed = (values.get('a') ?? '')
    .split(',')
    .filter((address) => address !== '');
  const secret = {
    code: values.get('c') ?? '',
    environmentId: values.get('e') ?? '',
  };
  if (base.endsWith(APP_PAIRING_PATH))
    return listed.length === 0
      ? undefined
      : {
          ...secret,
          addresses: listed,
          appOrigin: base.slice(0, -APP_PAIRING_PATH.length),
        };
  if (base.endsWith(PAGE_PATH))
    return {
      ...secret,
      addresses:
        listed.length === 0 ? [base.slice(0, -PAGE_PATH.length)] : listed,
    };
  return undefined;
}

const pairingLinkWireSchema = Schema.String;
const pairingLinkValueSchema = Schema.Struct({
  addresses: Schema.Array(Schema.String),
  code: Schema.String,
  environmentId: Schema.String,
  appOrigin: Schema.optional(Schema.String),
});
export const pairingLinkSchema = pairingLinkWireSchema.pipe(
  Schema.decodeTo(
    pairingLinkValueSchema,
    SchemaTransformation.transformEffect<
      typeof pairingLinkValueSchema.Type,
      typeof pairingLinkWireSchema.Type
    >({
      decode: (link) => {
        const parts = linkParts(link);
        return parts === undefined
          ? Effect.fail(
              new SchemaIssue.InvalidValue({
                message: 'Expected a Porcelain pairing link',
              }),
            )
          : Effect.succeed(parts);
      },
      encode: (parts) => Effect.succeed(pairingLink(parts)),
    }),
  ),
);
