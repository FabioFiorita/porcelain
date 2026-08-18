import type { McpToolHandlers } from './mcp-dispatch'

/**
 * The tool handlers, pending their operations.
 *
 * The transport lands first and complete: `tools/list` is the whole contract in a
 * stateless protocol — there is no handshake in which a server could advertise a
 * partial surface — so every tool is declared here from the start and answers
 * honestly that its body is not wired yet, rather than being hidden and changing
 * the surface underneath a client that already cached the list.
 */
export function createMcpToolHandlers(): McpToolHandlers {
  return {
    call: async (name) => ({
      text: `${name} is declared but not yet wired to the daemon's operations in this build.`,
      isError: true,
    }),
  }
}
