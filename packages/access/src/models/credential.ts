import { Schema } from 'effect';

export type CredentialKind = 'pcp' | 'pcd' | 'pct';

export const credentialPartsSchema = Schema.Struct({
  id: Schema.String,
  secret: Schema.Redacted(Schema.String),
});

export const credentialSchema = Schema.Struct({
  ...credentialPartsSchema.fields,
  token: Schema.Redacted(Schema.String),
});

export type Credential = typeof credentialSchema.Type;
export type CredentialParts = typeof credentialPartsSchema.Type;
