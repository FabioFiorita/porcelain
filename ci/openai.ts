import { appendFileSync } from 'node:fs';
import type OpenAI from 'openai';
import { Schema } from 'effect';

export const summaryModel = 'gpt-6.1-terra';
export const reviewModel = 'gpt-6.2-sol';
export const decisionModel = 'gpt-6-luna';

export const dollarsPerMillionTokens = {
  [reviewModel]: { input: 2, cached: 0.1, output: 10 },
  [decisionModel]: { input: 0.1, cached: 0.01, output: 0 },
  [summaryModel]: {
    input: 1,
    cached: 0.05,
    written: 1.25,
    output: 5,
    longContext: {
      aboveInputTokens: 272_000,
      prices: { input: 2, cached: 0.1, written: 2.5, output: 7.5 },
    },
  },
} as const;

type TokenPrices = {
  input: number;
  cached: number;
  written?: number;
  output: number;
};

export function dollars(
  model: keyof typeof dollarsPerMillionTokens,
  {
    input,
    cached,
    written = 0,
    output,
  }: { input: number; cached: number; written?: number; output: number },
): number {
  const long = dollarsPerMillionTokens[summaryModel].longContext;
  const price: TokenPrices =
    model === summaryModel && input > long.aboveInputTokens
      ? long.prices
      : dollarsPerMillionTokens[model];
  return (
    ((input - cached - written) * price.input +
      cached * price.cached +
      written * (price.written ?? price.input) +
      output * price.output) /
    1_000_000
  );
}

function formatCost(amount: number | undefined): string {
  return amount === undefined ? 'unavailable' : `$${amount.toFixed(6)} USD`;
}

export function jobCosts() {
  const costs: { step: string; amount: number | undefined }[] = [];
  return {
    record(step: string, amount: number | undefined): void {
      costs.push({ step, amount });
      console.log(`${step} estimated cost — ${formatCost(amount)}`);
    },
    summarize(heading: string): void {
      const total = costs.reduce((sum, { amount }) => sum + (amount ?? 0), 0);
      const unknown = costs.some(({ amount }) => amount === undefined);
      const summary = [
        heading,
        ...costs.map(({ step, amount }) => `- ${step}: ${formatCost(amount)}`),
        `- Estimated total: ${formatCost(total)}${unknown ? ' (some costs unknown)' : ''}`,
      ].join('\n');
      console.log(summary);
      const file = process.env.GITHUB_STEP_SUMMARY;
      if (file) appendFileSync(file, `${summary}\n`);
    },
  };
}

export function strictJsonSchema<A>(
  schema: Schema.Codec<A, unknown>,
): Record<string, unknown> {
  return Schema.toJsonSchemaDocument(schema, { onExcessProperty: 'error' })
    .schema;
}

export class InvalidStructuredResponse extends Error {
  constructor(cause: unknown) {
    super('Responses API returned an invalid structured response', { cause });
  }
}

export async function structuredAnswer<A>(
  client: OpenAI,
  request: {
    name: string;
    schema: Schema.Codec<A, unknown>;
    instructions: string;
    input: string;
    maxOutputTokens?: number;
    reasoning?: OpenAI.Reasoning;
    onCost: (cost: number | undefined) => void;
  },
): Promise<A> {
  const response = await client.responses
    .create({
      model: summaryModel,
      instructions: request.instructions,
      input: request.input,
      ...(request.maxOutputTokens === undefined
        ? {}
        : { max_output_tokens: request.maxOutputTokens }),
      ...(request.reasoning ? { reasoning: request.reasoning } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: request.name,
          strict: true,
          schema: strictJsonSchema(request.schema),
        },
      },
    })
    .catch((error: unknown) => {
      request.onCost(undefined);
      throw new Error('Responses API call failed', { cause: error });
    });
  const { usage } = response;
  request.onCost(
    usage
      ? dollars(summaryModel, {
          input: usage.input_tokens,
          cached: usage.input_tokens_details.cached_tokens,
          written: usage.input_tokens_details.cache_write_tokens ?? 0,
          output: usage.output_tokens,
        })
      : undefined,
  );
  if (response.status === 'incomplete')
    throw new InvalidStructuredResponse(
      new Error(
        `Incomplete response: ${response.incomplete_details?.reason ?? 'reason unavailable'}`,
      ),
    );
  try {
    return Schema.decodeUnknownSync(Schema.fromJsonString(request.schema))(
      response.output_text,
    );
  } catch (error) {
    throw new InvalidStructuredResponse(error);
  }
}
