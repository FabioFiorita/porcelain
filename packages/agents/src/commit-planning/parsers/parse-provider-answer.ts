import { Effect, Schema } from 'effect';

const claudeEnvelopeSchema = Schema.fromJsonString(
  Schema.Struct({ structured_output: Schema.Json }),
);
const codexAnswerSchema = Schema.fromJsonString(Schema.Json);

export const claudeAnswer = (output: string) =>
  Schema.decodeUnknownEffect(claudeEnvelopeSchema)(output).pipe(
    Effect.map((reply) => reply.structured_output),
  );
export const codexAnswer = Schema.decodeUnknownEffect(codexAnswerSchema);
