import { Schema, SchemaTransformation } from 'effect';

const summaryPath =
  /^\/review-summaries\/(?<token>[^?]*)\?expires=(?<expires>[^&]*)&signature=(?<signature>.*)$/;

const byteLengthSchema = Schema.Number.check(Schema.isInt()).check(
  Schema.isGreaterThan(0),
);

const reviewSummaryLinkWireSchema = Schema.Struct({
  url: Schema.String.check(Schema.isMinLength(1)),
  byteLength: byteLengthSchema,
});
const reviewSummaryLinkValueSchema = Schema.Struct({
  token: Schema.String,
  expires: Schema.String,
  signature: Schema.String,
  byteLength: byteLengthSchema,
});
export const reviewSummaryLinkSchema = reviewSummaryLinkWireSchema.pipe(
  Schema.decodeTo(
    reviewSummaryLinkValueSchema,
    SchemaTransformation.transform<
      typeof reviewSummaryLinkValueSchema.Type,
      typeof reviewSummaryLinkWireSchema.Type
    >({
      decode: (link) => {
        const parts = summaryPath.exec(link.url)?.groups;
        return {
          token: decodeURIComponent(parts?.token ?? ''),
          expires: decodeURIComponent(parts?.expires ?? ''),
          signature: decodeURIComponent(parts?.signature ?? ''),
          byteLength: link.byteLength,
        };
      },
      encode: (grant) => ({
        url: `/review-summaries/${encodeURIComponent(grant.token)}?expires=${encodeURIComponent(grant.expires)}&signature=${encodeURIComponent(grant.signature)}`,
        byteLength: grant.byteLength,
      }),
    }),
  ),
);
