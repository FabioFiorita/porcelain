import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { ByteSize, Context, Effect, Layer, Result, Schema } from 'effect';
import { McpProtocol, McpSchema, McpServer } from 'effect/ai';
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/http';
import {
  walkthroughBlockRequestSchema,
  type WalkthroughBlockRequest,
} from '@porcelain/contracts/walkthroughs';

export const WALKTHROUGH_MCP_NAME = 'porcelain_walkthrough';
export const WALKTHROUGH_MCP_TOKEN_ENV = 'PORCELAIN_WALKTHROUGH_MCP_TOKEN';
const MAX_PROPOSALS = 96;
const blockTools = {
  diff_excerpt:
    'Place a line range from one captured diff hunk. Use the old path on the old side of a rename.',
  before_after:
    'Place two distinct existing PR image assets. Use only asset IDs in the prompt and describe what each existing image shows.',
  files: 'List changed files at this stop. Use paths from the captured change.',
  checks:
    'Show recorded PR check results for the captured head. Supply only the exact head commit.',
  callout:
    'Place a decision or risk as text. Supply a question and why it matters. Use a short two-column comparison when it helps.',
  diagram:
    'Draw how changed parts relate, as nodes and edges, only when a call path, data flow or responsibility changed. Anchor nodes to changed files and captured lines. Draw nothing the diff does not show; in a sequence, edge order is time.',
} satisfies Record<WalkthroughBlockRequest['kind'], string>;

export const openWalkthroughMcp = Effect.fn('WalkthroughWriter.openMcp')(
  function* () {
    const token = randomUUID();
    const blocks = new Map<string, WalkthroughBlockRequest>();
    const registration = Layer.effectDiscard(
      Effect.gen(function* () {
        const mcp = yield* McpServer.McpServer;
        for (const schema of walkthroughBlockRequestSchema.members) {
          const kind = schema.fields.kind.literal;
          const { kind: _kind, ...fields } = schema.fields;
          const parameters = Schema.Struct(fields);
          const decode = Schema.decodeUnknownResult(parameters, {
            onExcessProperty: 'error',
          });
          const inputSchema = Schema.toJsonSchemaDocument(parameters, {
            onExcessProperty: 'error',
          }).schema;
          yield* mcp.addTool({
            tool: new McpSchema.Tool({
              name: kind,
              description: blockTools[kind],
              inputSchema: { ...inputSchema, type: 'object' },
              annotations: { readOnlyHint: true },
            }),
            annotations: Context.empty(),
            handle: (input: unknown) =>
              Effect.sync(() => {
                const decoded = decode(input);
                if (Result.isFailure(decoded) || blocks.size >= MAX_PROPOSALS)
                  return new McpSchema.CallToolResult({
                    isError: true,
                    content: [
                      {
                        type: 'text',
                        text: 'This block request could not be recorded.',
                      },
                    ],
                  });
                const blockId = randomUUID();
                const request = Schema.decodeUnknownSync(schema)({
                  ...decoded.success,
                  kind,
                });
                blocks.set(blockId, request);
                return new McpSchema.CallToolResult({
                  content: [
                    { type: 'text', text: JSON.stringify({ blockId }) },
                  ],
                });
              }),
          });
        }
      }),
    );
    const transport = McpServer.layerHttp({
      name: WALKTHROUGH_MCP_NAME,
      version: '1',
      path: '/mcp',
      protocols: [McpProtocol.v2025_11_25, McpProtocol.v2025_06_18],
      registrations: registration,
    });
    const context = yield* Layer.build(
      HttpRouter.serve(transport, {
        disableLogger: true,
        disableListenLog: true,
        middleware: (app) =>
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            if (request.headers.authorization !== `Bearer ${token}`)
              return HttpServerResponse.empty({ status: 401 });
            return yield* app.pipe(
              Effect.provideService(
                HttpIncomingMessage.MaxBodySize,
                ByteSize.kibibytes(64),
              ),
            );
          }),
      }).pipe(
        Layer.provideMerge(
          NodeHttpServer.layerServer(
            () =>
              createServer({ requestTimeout: 10_000, headersTimeout: 5000 }),
            { host: '127.0.0.1', port: 0 },
          ),
        ),
      ),
    );
    const { address } = Context.get(context, HttpServer.HttpServer);
    if (address._tag !== 'InetAddressV4')
      return yield* Effect.die(
        'Expected a loopback address for walkthrough tools',
      );
    return {
      url: `http://127.0.0.1:${address.port}/mcp`,
      token,
      resolveBlocks: (ids: readonly string[]) =>
        ids.flatMap((id) => {
          const block = blocks.get(id);
          blocks.delete(id);
          return block === undefined ? [] : [block];
        }),
    };
  },
);
