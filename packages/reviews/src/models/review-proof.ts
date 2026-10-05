import { Schema } from 'effect';
const proofTargetSchema = Schema.Struct({
  layerId: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  stepId: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const proofCheckSchema = Schema.Struct({
  ...proofTargetSchema.fields,
  name: Schema.mutableKey(Schema.String),
  result: Schema.mutableKey(
    Schema.Union([
      Schema.Literal('pass'),
      Schema.Literal('fail'),
      Schema.Literal('skipped'),
    ]),
  ),
  output: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const proofFileKindSchema = Schema.Union([
  Schema.Literal('image'),
  Schema.Literal('video'),
]);
export const proofMediaTypeSchema = Schema.Union([
  Schema.Literal('image/png'),
  Schema.Literal('image/jpeg'),
  Schema.Literal('image/gif'),
  Schema.Literal('image/webp'),
  Schema.Literal('video/mp4'),
  Schema.Literal('video/webm'),
]);
const proofFileAssetSchema = Schema.Struct({
  ...proofTargetSchema.fields,
  id: Schema.mutableKey(Schema.String),
  kind: Schema.mutableKey(proofFileKindSchema),
  title: Schema.mutableKey(Schema.String),
  mediaType: Schema.mutableKey(proofMediaTypeSchema),
  byteLength: Schema.mutableKey(Schema.Number),
});
const proofLinkDraftSchema = Schema.Struct({
  ...proofTargetSchema.fields,
  kind: Schema.mutableKey(Schema.Literal('link')),
  title: Schema.mutableKey(Schema.String),
  url: Schema.mutableKey(Schema.String),
});
const proofLinkAssetSchema = Schema.Struct({
  ...proofLinkDraftSchema.fields,
  id: Schema.mutableKey(Schema.String),
});
const proofAssetSchema = Schema.Union([
  proofFileAssetSchema,
  proofLinkAssetSchema,
]);
const proofBaselineSchema = Schema.Struct({
  digest: Schema.mutableKey(Schema.String),
  proofPaths: Schema.mutableKey(Schema.Array(Schema.String)),
});
export const reviewProofSchema = Schema.Struct({
  checks: Schema.mutableKey(Schema.Array(proofCheckSchema)),
  assets: Schema.mutableKey(Schema.Array(proofAssetSchema)),
  baseline: Schema.mutableKey(
    Schema.optional(Schema.Union([proofBaselineSchema, Schema.Undefined])),
  ),
});

export type ProofTarget = typeof proofTargetSchema.Type;

type ProofCheck = typeof proofCheckSchema.Type;

export type ProofFileKind = typeof proofFileKindSchema.Type;

export type ProofMediaType = typeof proofMediaTypeSchema.Type;

export type ProofFileDraft = ProofTarget & {
  kind: ProofFileKind;
  title: string;
  path?: string | undefined;
  proofId?: string | undefined;
};

type ProofLinkDraft = typeof proofLinkDraftSchema.Type;

type ProofAssetDraft = ProofFileDraft | ProofLinkDraft;

export type ProofDraft = {
  checks?: readonly ProofCheck[] | undefined;
  assets?: readonly ProofAssetDraft[] | undefined;
};

export type ProofAsset = typeof proofAssetSchema.Type;

export type ReviewProof = typeof reviewProofSchema.Type;

export type ResolvedProof = {
  checks: readonly ProofCheck[];
  assets: readonly ProofAsset[];
  current: boolean;
};

export type ProofFile = {
  id: string;
  mediaType: ProofMediaType;
  bytes: Uint8Array;
};

export type ProofFileKey = {
  worktreeId: string;
  proofId: string;
};

export type ProofFileReads = {
  files: ReadonlyMap<string, Uint8Array>;
  tooLarge: readonly string[];
};

export type ProofLimits = {
  totalBytes: number;
  signatureBytes: number;
};
