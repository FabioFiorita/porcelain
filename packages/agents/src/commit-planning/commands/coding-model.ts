import { Effect, JsonSchema, Layer, Schema, Stream } from 'effect';
import { AiError, LanguageModel, Model } from 'effect/ai';
import type { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

export function codingModel(
  provider: string,
  model: string,
  answer: (
    prompt: string,
    schema: string,
  ) => Effect.Effect<unknown, ProviderProcessFailedError | Schema.SchemaError>,
) {
  return Model.make(
    provider,
    model,
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: Effect.fn('CodingModel.generateObject')(
          function* (options) {
            const message = options.prompt.content[0];
            if (
              options.responseFormat.type !== 'json' ||
              options.tools.length ||
              options.toolChoice !== 'none' ||
              options.prompt.content.length !== 1 ||
              message?.role !== 'user' ||
              message.content.some((part) => part.type !== 'text')
            )
              return yield* Effect.fail(
                AiError.make({
                  module: provider,
                  method: 'generateObject',
                  reason: new AiError.InvalidRequestError({
                    description:
                      'Coding tools accept one text prompt for a structured commit plan without tools.',
                  }),
                }),
              );
            const prompt = message.content
              .map((part) => (part.type === 'text' ? part.text : ''))
              .join('');
            const document = JsonSchema.toDocumentDraft07(
              Schema.toJsonSchemaDocument(options.responseFormat.schema, {
                onExcessProperty: 'error',
              }),
            );
            const schema = JSON.stringify({
              ...document.schema,
              $schema: JsonSchema.META_SCHEMA_URI_DRAFT_07,
              definitions: document.definitions,
            });
            const result = yield* answer(prompt, schema).pipe(
              Effect.mapError((error) =>
                AiError.make({
                  module: provider,
                  method: 'generateObject',
                  reason:
                    error instanceof Schema.SchemaError
                      ? AiError.InvalidOutputError.fromSchemaError(error)
                      : new AiError.InternalProviderError({
                          description: error.message,
                        }),
                }),
              ),
            );
            return [{ type: 'text' as const, text: JSON.stringify(result) }];
          },
        ),
        streamText: () =>
          Stream.fail(
            AiError.make({
              module: provider,
              method: 'streamText',
              reason: new AiError.InvalidRequestError({
                description:
                  'Coding tool commit drafting returns one confirmed structured result.',
              }),
            }),
          ),
      }),
    ),
  );
}
