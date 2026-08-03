import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

const CLI = join(__dirname, '..', 'out', 'main', 'cli', 'porcelain.js')

const EVIDENCE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>body{margin:0;padding:16px;background:#0b0b0f;color:#e5e7eb;font-family:system-ui}</style>
</head><body><h1>CLI Publish Canary</h1><p class="pass">PASS</p>
<script>document.body.innerHTML='SCRIPT EXECUTED'</script>
</body></html>
`

/** Run the built porcelain CLI against the e2e fixture channel env (not the human’s ~/.porcelain). */
async function runFixtureCli(
  args: string[],
  env: Record<string, string>,
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout?.on('data', (c: Buffer) => {
      out += c.toString()
    })
    child.stderr?.on('data', (c: Buffer) => {
      err += c.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(`porcelain ${args.join(' ')} failed (${code}): ${err || out}`))
    })
  })
}

test('CLI review set then evidence appears on the Review canvas', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Review')

  // Empty → start-of-unit canvas (open the feature tab if the list is empty).
  await expect(loc.featureList(page)).toBeVisible({ timeout: 15_000 })
  // Open canvas via empty list is passive; open a feature tab by selecting Review
  // and using the viewer empty state — click the rail Review already selected.
  // Force open the canvas by writing Intent-only first via CLI, then Open Review.

  await runFixtureCli(
    [
      'review',
      'set',
      '--repo',
      repoDir,
      '--name',
      'CLI Intent-only unit',
      '--thesis',
      'Start of unit: Intent first, Execution thin.',
      '--files',
      '[]',
      '--sections',
      JSON.stringify([
        {
          title: 'Scope',
          prose: 'Intent-only publish from the e2e CLI path.',
          anchors: [],
        },
      ]),
    ],
    seeded.env,
    repoDir,
  )

  await expect(loc.featureOpenReview(page)).toBeVisible({ timeout: 15_000 })
  await loc.featureOpenReview(page).click()
  await expect(loc.featureCanvas(page)).toBeVisible({ timeout: 15_000 })
  await expect(loc.featureCanvas(page)).toContainText('CLI Intent-only unit')
  await expect(loc.featureLifecycle(page)).toBeVisible({ timeout: 10_000 })
  await expect(loc.featureLifecycle(page)).toHaveAttribute('data-phase', 'in_progress')

  // Grow Execution + Evidence (end of unit path).
  await runFixtureCli(
    [
      'review',
      'set',
      '--repo',
      repoDir,
      '--name',
      'CLI Intent-only unit',
      '--thesis',
      'Start of unit: Intent first, Execution thin.',
      '--files',
      JSON.stringify([{ path: 'src/pages/Home.tsx', note: 'entry' }]),
      '--sections',
      JSON.stringify([
        {
          title: 'Scope',
          prose: 'Full Execution after implement.',
          anchors: [{ path: 'src/pages/Home.tsx' }],
        },
      ]),
    ],
    seeded.env,
    repoDir,
  )

  const prepareOut = await runFixtureCli(
    ['evidence', 'prepare', '--repo', repoDir, '--title', 'CLI smoke'],
    seeded.env,
    repoDir,
  )
  // CLI: `Evidence directory ready for "…" at:\n<dir>\n\nWrite index.html…`
  const pathLine = prepareOut
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('/') || l.includes('.porcelain/evidence'))
  const evidenceDir = pathLine ?? join(repoDir, '.porcelain', 'evidence')
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(join(evidenceDir, 'index.html'), EVIDENCE_HTML)

  await expect(loc.featureCanvas(page)).toContainText('CLI Intent-only unit', { timeout: 15_000 })
  // Evidence tab becomes available once meta/html land.
  await expect(loc.featureCanvasTab(page, 'evidence')).toBeEnabled({ timeout: 15_000 })
  await loc.featureCanvasTab(page, 'evidence').click()
  await expect(loc.evidencePanel(page)).toBeVisible({ timeout: 15_000 })

  const iframeEl = loc.evidenceIframe(page)
  await expect(iframeEl).toBeVisible({ timeout: 15_000 })
  expect(await iframeEl.getAttribute('sandbox')).toBe('')
  const frame = iframeEl.contentFrame()
  await expect(frame.locator('h1')).toHaveText('CLI Publish Canary', { timeout: 15_000 })
  await expect(frame.locator('body')).not.toContainText('SCRIPT EXECUTED')

  await expect(loc.featureLifecycle(page)).toHaveAttribute('data-phase', 'ready_to_close', {
    timeout: 10_000,
  })
})
