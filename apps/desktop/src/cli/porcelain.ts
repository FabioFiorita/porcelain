import { runCli } from './cli'

// Process entry for the Porcelain agent CLI. electron-vite bundles this to
// out/main/cli/porcelain.js; the daemon/Mac shell copies it to ~/.porcelain/porcelain.js
// with a `porcelain` sh wrapper. Node builtins only (see cli.ts) so a plain `node` runs
// it. Output → stdout; a thrown error → stderr, exit code 1.

async function main(): Promise<void> {
  try {
    const output = await runCli(process.argv.slice(2))
    process.stdout.write(`${output}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

main()
