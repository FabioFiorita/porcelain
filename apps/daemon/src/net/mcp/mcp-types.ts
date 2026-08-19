/** What a tool returns. The daemon speaks Porcelain results; this is the wire shape. */
export type McpToolResult = Readonly<{ text: string; isError?: boolean }>

/** The seam commit A leaves open: transport first, operations behind it. */
export type McpToolHandlers = Readonly<{
  call: (name: string, args: Record<string, unknown>) => Promise<McpToolResult>
}>
