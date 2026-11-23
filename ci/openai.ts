import type OpenAI from 'openai';
import type { ResponseUsage } from 'openai/resources/responses/responses';
import { Schema } from 'effect';

export const summaryModel = 'gpt-6.1-terra';
export const reviewModel = 'gpt-6.2-sol';
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

export function summaryDollars(usage: ResponseUsage): number {
  const cached = usage.input_tokens_details.cached_tokens;
  const written = usage.input_tokens_details.cache_write_tokens ?? 0;
  const uncached = usage.input_tokens - cached - written;
  const longContext = usage.input_tokens > 272_000;
  const input = uncached + 0.05 * cached + 1.25 * written;
  return (
    (input * (longContext ? 2 : 1) +
      usage.output_tokens * (longContext ? 7.5 : 5)) /
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
    onUsage?: (usage: ResponseUsage | undefined) => void;
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
  request.onUsage?.(response.usage);
  return Schema.decodeUnknownSync(Schema.fromJsonString(request.schema))(
    response.output_text,
  );
}
