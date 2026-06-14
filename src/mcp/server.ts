import { createInterface } from 'readline'
import { handleRpc } from './protocol'
import { addReviewFiles, clearReview, setReview, toReviewFiles } from './review-file'

// Porcelain's MCP server: a standalone stdio process the user's coding agent spawns
// (e.g. `claude mcp add porcelain -- node <app>/out/main/mcp/server.js`). It writes
// feature review sets the running Porcelain app watches and renders. stdio only —
// no network port, so it adds no inbound surface to the app.

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const repoPath = asString(args.repoPath)
  if (!repoPath) throw new Error('repoPath is required')

  if (name === 'set_feature_review') {
    const reviewName = asString(args.name) ?? 'Feature view'
    const files = toReviewFiles(args.files)
    setReview(repoPath, reviewName, files)
    return `Set feature review "${reviewName}" (${files.length} files) for ${repoPath}`
  }
  if (name === 'add_review_files') {
    const files = toReviewFiles(args.files)
    const total = addReviewFiles(repoPath, files)
    return `Added ${files.length} file(s); the feature review now has ${total} for ${repoPath}`
  }
  if (name === 'clear_feature_review') {
    clearReview(repoPath)
    return `Cleared the feature review for ${repoPath}`
  }
  throw new Error(`unknown tool: ${name}`)
}

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
