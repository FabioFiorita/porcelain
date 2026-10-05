import { Schema } from 'effect';
import { fingerprintedFileSchema } from './fingerprinted-file.ts';
const upstreamExpectationSchema = Schema.Struct({
  oid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
export const gitActionExpectationSchema = Schema.Struct({
  headOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  branch: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  inProgress: Schema.mutableKey(
    Schema.optional(
      Schema.Union([
        Schema.Literal('merge'),
        Schema.Literal('rebase'),
        Schema.Undefined,
      ]),
    ),
  ),
  mergeHeadOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  upstream: Schema.mutableKey(
    Schema.optional(
      Schema.Union([upstreamExpectationSchema, Schema.Undefined]),
    ),
  ),
  files: Schema.mutableKey(
    Schema.optional(
      Schema.Union([Schema.Array(fingerprintedFileSchema), Schema.Undefined]),
    ),
  ),
});

export type GitActionExpectation = typeof gitActionExpectationSchema.Type;
