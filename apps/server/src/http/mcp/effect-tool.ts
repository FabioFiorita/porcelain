import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { Cause, Effect, Exit, JsonSchema, Result, Schema } from 'effect';
import { z } from 'zod';
import { withSignal } from '@porcelain/effects';
import { toStatusResponse } from '../status-policy.ts';

export function registerEffectTool<A, I, B, J, E>(
  server: McpServer,
  definition: {
    name: string;
    description?: string;
    annotations?: ToolAnnotations;
    input: Schema.ConstraintCodec<A, I>;
    output: Schema.ConstraintCodec<B, J>;
  },
  operation: (input: A) => Effect.Effect<B, E>,
) {
  const document = JsonSchema.toDocumentDraft07(
    Schema.toJsonSchemaDocument(Schema.toEncoded(definition.input), {
      onExcessProperty: 'error',
    }),
  );
  const generated = z.fromJSONSchema({
    ...document.schema,
    definitions: document.definitions,
  });
  if (!(generated instanceof z.ZodObject))
    throw new Error(
      `MCP tool ${definition.name} must describe an object input`,
    );
  const inputSchema = generated.superRefine((input, context) => {
    const decoded = Schema.decodeUnknownResult(definition.input, {
      onExcessProperty: 'error',
    })(input);
    if (Result.isFailure(decoded))
      context.addIssue({ code: 'custom', message: decoded.failure.message });
  });
  return server.registerTool(
    definition.name,
    {
      inputSchema,
      ...(definition.description === undefined
        ? {}
        : { description: definition.description }),
      ...(definition.annotations === undefined
        ? {}
        : { annotations: definition.annotations }),
    },
    async (input, { signal }) => {
      try {
        const exit = await Effect.runPromiseExit(
          withSignal(
            Schema.decodeUnknownEffect(definition.input, {
              onExcessProperty: 'error',
            })(input).pipe(Effect.flatMap(operation)),
            signal,
          ),
          { signal },
        );
        if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                Schema.encodeSync(definition.output)(exit.value),
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(toStatusResponse(error).body ?? null),
            },
          ],
        };
      }
    },
  );
}
