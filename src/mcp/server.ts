import { createInterface } from 'node:readline'
import { handleRpc } from './protocol'
import { watchServerBinaryForUpgrade } from './self-reload'
import { callTool } from './tools'

// Porcelain's MCP server: a standalone stdio process the user's coding agent spawns
// (e.g. `claude mcp add porcelain -- node <app>/out/main/mcp/server.js`). It writes
// feature review sets the running Porcelain app watches and renders. stdio only —
// no network port, so it adds no inbound surface to the app.

// When the daemon/app re-copies this script (ensureMcpServer), exit so the agent
// restarts us with the new tool list — see self-reload.ts.
watchServerBinaryForUpgrade()

async function processLine(line: string): Promise<void> {
  const trimmed = line.trim()
  if (trimmed === '') return
  let message: unknown
  try {
    message = JSON.parse(trimmed)
  } catch {
    return // ignore non-JSON noise on the line channel
  }
  try {
    const response = await handleRpc(message, callTool)
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
  } catch (error) {
    process.stderr.write(
      `porcelain-mcp: ${error instanceof Error ? error.message : String(error)}\n`,
    )
  }
}

// Process lines strictly in order: tool calls mutate one shared file, so an out-of-
// order or concurrent run could drop a write.
let chain: Promise<void> = Promise.resolve()
const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  chain = chain.then(() => processLine(line))
})
