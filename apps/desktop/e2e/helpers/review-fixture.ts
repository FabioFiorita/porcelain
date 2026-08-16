import { spawn } from 'node:child_process'
import { join } from 'node:path'

const CLI = join(__dirname, '..', '..', 'out', 'main', 'cli', 'porcelain.js')

/**
 * Real media bytes for the fixture Review. Evidence is proof, and a gallery that only ever sees a
 * data-URL-shaped string proves nothing about whether the browser can decode what an agent wrote —
 * so these are an actual PNG and an actual two-frame H.264 MP4.
 */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
// Two black 16×16 H.264 frames in an MP4 container, generated once for the
// fixture so the browser has real media bytes rather than only a video-shaped
// data URL.
export const VIDEO_BYTES = Buffer.from(
  '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',
  'base64',
)

/** Run the built CLI against the per-test fixture, never the developer's companion. */
export async function runFixtureCli(
  args: string[],
  env: Record<string, string>,
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let error = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      error += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`porcelain ${args.join(' ')} failed (${code}): ${error || output}`))
    })
  })
}

/** Publish a Review through the built CLI, the same boundary an agent uses. */
export async function publishFixtureReview(
  repoDir: string,
  env: Record<string, string>,
  review: { name: string; thesis: string; sectionTitle: string; sectionProse: string },
): Promise<void> {
  await runFixtureCli(
    [
      'review',
      'set',
      '--repo',
      repoDir,
      '--name',
      review.name,
      '--thesis',
      review.thesis,
      '--files',
      '[]',
      '--sections',
      JSON.stringify([{ title: review.sectionTitle, prose: review.sectionProse, anchors: [] }]),
    ],
    env,
    repoDir,
  )
}
