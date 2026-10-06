import { Schema } from 'effect';

export type CredentialKind = 'pcp' | 'pcd' | 'pct';

const credentialPartsSchema = Schema.Struct({
  id: Schema.String,
  secret: Schema.Redacted(Schema.String),
});

const credentialSchema = Schema.Struct({
  id: Schema.String,
  secret: Schema.Redacted(Schema.String),
  token: Schema.Redacted(Schema.String),
});

export type Credential = typeof credentialSchema.Type;
export type CredentialParts = typeof credentialPartsSchema.Type;
