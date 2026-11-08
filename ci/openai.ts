import type OpenAI from 'openai';
import { Schema } from 'effect';

export const summaryModel = 'gpt-6.1-terra';
export const reviewModel = 'gpt-6.1-sol';
export const decisionModel = 'gpt-6-luna';

export const dollarsPerMillionTokens = {
  [reviewModel]: { input: 2, cached: 0.1, output: 10 },
  [decisionModel]: { input: 0.1, cached: 0.01, output: 0 },
} as const;

export function dollars(
  model: keyof typeof dollarsPerMillionTokens,
  usage: { input: number; cached: number; output: number },
): number {
  const price = dollarsPerMillionTokens[model];
  return (
    ((usage.input - usage.cached) * price.input +
      usage.cached * price.cached +
      usage.output * price.output) /
    1_000_000
  );
}

export function strictJsonSchema<A>(
  schema: Schema.Codec<A, unknown>,
): Record<string, unknown> {
  return Schema.toJsonSchemaDocument(schema, { onExcessProperty: 'error' })
    .schema;
}

export async function structuredAnswer<A>(
  client: OpenAI,
  request: {
    name: string;
    schema: Schema.Codec<A, unknown>;
    instructions: string;
    input: string;
  },
): Promise<A> {
  const response = await client.responses.create({
    model: summaryModel,
    instructions: request.instructions,
    input: request.input,
    text: {
      format: {
        type: 'json_schema',
        name: request.name,
        strict: true,
        schema: strictJsonSchema(request.schema),
      },
    },
  });
  return Schema.decodeUnknownSync(Schema.fromJsonString(request.schema))(
    response.output_text,
  );
}
