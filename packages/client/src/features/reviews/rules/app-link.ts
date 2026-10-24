import * as Schema from 'effect/Schema';
import { reviewAppLinkProtocolSchema } from '@porcelain/contracts/reviews';

const segment = Schema.String.check(Schema.isUUID());
const revisionNumber = Schema.FiniteFromString.check(Schema.isInt()).check(
  Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
);
const destinationSchema = Schema.Struct({
  reviewId: segment,
  environmentId: Schema.NonEmptyString,
  host: Schema.NonEmptyString,
  protocol: Schema.optional(reviewAppLinkProtocolSchema),
  revision: Schema.optional(revisionNumber),
  decision: Schema.optional(segment),
});

type Destination = typeof destinationSchema.Type;
export type ReviewAppLink = Destination & { readonly webUrl: string };

export function parseReviewAppLink(value: string): ReviewAppLink | undefined {
  try {
    const url = new URL(value, 'https://porcelain.fabiofiorita.com');
    if (
      url.origin !== 'https://porcelain.fabiofiorita.com' ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/open\/reviews\/[^/]+$/.test(url.pathname)
    )
      return undefined;
    const allowed = new Set([
      'environment',
      'host',
      'protocol',
      'revision',
      'decision',
    ]);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1)
        return undefined;
    }
    const revision = url.searchParams.get('revision');
    if (revision !== null && !/^[1-9]\d*$/.test(revision)) return undefined;
    const result = Schema.decodeUnknownSync(destinationSchema)({
      reviewId: decodeURIComponent(url.pathname.slice('/open/reviews/'.length)),
      environmentId: url.searchParams.get('environment'),
      host: url.searchParams.get('host'),
      ...(url.searchParams.has('protocol')
        ? { protocol: url.searchParams.get('protocol') }
        : {}),
      ...(revision === null ? {} : { revision }),
      ...(url.searchParams.has('decision')
        ? { decision: url.searchParams.get('decision') }
        : {}),
    });
    if (
      !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*|\[[a-fA-F0-9:]+\])(?::[1-9]\d{0,4})?$/.test(
        result.host,
      )
    )
      return undefined;
    const protocol = result.protocol ?? 'https';
    const host = new URL(`${protocol}://${result.host}`);
    if (
      host.host !== result.host.toLowerCase() &&
      host.host !==
        result.host
          .toLowerCase()
          .replace(protocol === 'http' ? /:80$/ : /:443$/, '')
    )
      return undefined;
    return { ...result, webUrl: reviewAppLinkWebUrl(result) };
  } catch {
    return undefined;
  }
}

function reviewAppLinkWebUrl(link: Destination): string {
  const url = new URL(
    `/reviews/${encodeURIComponent(link.reviewId)}`,
    `${link.protocol ?? 'https'}://${link.host}`,
  );
  if (link.revision !== undefined) url.pathname += `/${link.revision}`;
  if (link.decision !== undefined) {
    if (link.revision !== undefined)
      url.pathname += `/decisions/${encodeURIComponent(link.decision)}`;
    else url.searchParams.set('decision', link.decision);
  }
  return url.toString();
}
