import { Schema } from 'effect';

const watchHostRequest = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('subscribe'),
    request: Schema.Int,
    subscription: Schema.Int,
    directory: Schema.String,
    ignore: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal('unsubscribe'),
    request: Schema.Int,
    subscription: Schema.Int,
  }),
  Schema.Struct({
    kind: Schema.Literal('ping'),
    request: Schema.Int,
  }),
]);
export type WatchHostRequest = typeof watchHostRequest.Type;

const watchHostEvent = Schema.Struct({
  path: Schema.String,
  type: Schema.Literals(['create', 'update', 'delete']),
});
export type WatchHostEvent = typeof watchHostEvent.Type;

const watchHostMessage = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('answer'),
    request: Schema.Int,
    failure: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal('events'),
    subscription: Schema.Int,
    failure: Schema.optional(Schema.String),
    events: Schema.Array(watchHostEvent),
  }),
]);
export type WatchHostMessage = typeof watchHostMessage.Type;

export const decodeWatchHostRequest = Schema.decodeUnknownOption(
  Schema.fromJsonString(watchHostRequest),
);
export const decodeWatchHostMessage = Schema.decodeUnknownOption(
  Schema.fromJsonString(watchHostMessage),
);
