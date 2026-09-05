import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, waitForShell } from './helpers/app'

test('sample reviews use the shipped connector and current Canvas contract', async ({
  page,
  seeded,
  repoDir,
}) => {
  await waitForShell(page)
  await writeFile(join(repoDir, 'src/greeting.ts'), "export const greeting = 'hello'\n")
  const source = pathToFileURL(resolve('../../scripts/dev-seed.mjs')).href
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    const { canvasCall, reviewCanvasInput, SEEDED_REVIEWS } = await import(process.argv[1]);
    const input = reviewCanvasInput(process.argv[2], SEEDED_REVIEWS[0].review);
    const created = canvasCall(input, process.env);
    const value = JSON.parse(created.content[0].text).value;
    if (!value.id) throw new Error('Canvas creation returned no id');
    canvasCall({ ...input, op: 'update', id: value.id }, process.env);
    console.log(JSON.stringify(canvasCall({ op: 'get', workspace: process.argv[2], id: value.id }, process.env)));
  `,
      source,
      repoDir,
    ],
    {
      env: { ...process.env, PORCELAIN_HOME: seeded.udBase, PORCELAIN_MCP_SOCKET: '' },
      encoding: 'utf8',
      timeout: 30000,
    },
  )
  expect(output).toContain('Playground review')
})
