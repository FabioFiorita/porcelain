import { z } from 'zod';

const summaryPath =
  /^\/review-summaries\/(?<token>[^?]*)\?expires=(?<expires>[^&]*)&signature=(?<signature>.*)$/;

const byteLengthSchema = z.number().int().positive();

export const reviewSummaryLinkSchema = z.codec(
  z.object({ url: z.string().min(1), byteLength: byteLengthSchema }),
  z.object({
    token: z.string(),
    expires: z.string(),
    signature: z.string(),
    byteLength: byteLengthSchema,
  }),
  {
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
  },
);
