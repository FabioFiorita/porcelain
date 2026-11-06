import type OpenAI from 'openai';
import { Schema } from 'effect';

export const summaryModel = 'gpt-6.1-terra';
export const reviewModel = 'gpt-6.1-sol';
export const decisionModel = 'gpt-6-luna';

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
