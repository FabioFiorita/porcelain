import { Schema } from 'effect';
export const gitActionIntentSchema = Schema.Union([
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('pull')),
    remoteName: Schema.mutableKey(Schema.String),
    sourceRef: Schema.mutableKey(Schema.String),
    strategy: Schema.mutableKey(
      Schema.optional(
        Schema.Union([
          Schema.Literal('ff-only'),
          Schema.Literal('merge'),
          Schema.Literal('rebase'),
          Schema.Undefined,
        ]),
      ),
    ),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('fetch')),
    remoteName: Schema.mutableKey(Schema.String),
    sourceRef: Schema.mutableKey(Schema.String),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('push')),
    remoteName: Schema.mutableKey(Schema.String),
    destinationRef: Schema.mutableKey(Schema.String),
    allowCreate: Schema.mutableKey(Schema.Boolean),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('commit')),
    message: Schema.mutableKey(Schema.String),
    paths: Schema.mutableKey(Schema.Array(Schema.String)),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('amend')),
    message: Schema.mutableKey(Schema.String),
    paths: Schema.mutableKey(Schema.Array(Schema.String)),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('stash-create')),
    message: Schema.mutableKey(Schema.String),
    includeUntracked: Schema.mutableKey(Schema.Boolean),
  }),
  Schema.Struct({
    action: Schema.mutableKey(
      Schema.Union([
        Schema.Literal('stash-apply'),
        Schema.Literal('stash-pop'),
      ]),
    ),
    stashOid: Schema.mutableKey(Schema.String),
    restoreIndex: Schema.mutableKey(Schema.Boolean),
  }),
  Schema.Struct({
    action: Schema.mutableKey(Schema.Literal('discard')),
    path: Schema.mutableKey(Schema.String),
    hunk: Schema.mutableKey(
      Schema.optional(
        Schema.Union([
          Schema.Struct({
            scope: Schema.mutableKey(
              Schema.Union([
                Schema.Literal('staged'),
                Schema.Literal('unstaged'),
              ]),
            ),
            startLine: Schema.mutableKey(Schema.Number),
            endLine: Schema.mutableKey(Schema.Number),
          }),
          Schema.Undefined,
        ]),
      ),
    ),
  }),
]);

export type GitActionIntent = typeof gitActionIntentSchema.Type;

export type GitActionKind = GitActionIntent['action'];
