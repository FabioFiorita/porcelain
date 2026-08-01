import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// Fixed identity + dates so commit hashes (and thus anything derived from them)
// are stable across runs. History relative-times are still runtime-derived, so
// don't screenshot the History list.
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Porcelain E2E',
  GIT_AUTHOR_EMAIL: 'e2e@porcelain.test',
  GIT_COMMITTER_NAME: 'Porcelain E2E',
  GIT_COMMITTER_EMAIL: 'e2e@porcelain.test',
  GIT_AUTHOR_DATE: '2024-01-01T12:00:00Z',
  GIT_COMMITTER_DATE: '2024-01-01T12:00:00Z',
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, stdio: 'pipe' })
}

async function writeFixtureFile(dir: string, rel: string, body: string): Promise<void> {
  const full = join(dir, rel)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, body)
}

const BUTTON_V1 = `export function Button(props: { label: string }) {
  return <button>{props.label}</button>
}
`

const BUTTON_V2 = `export function Button(props: { label: string; variant?: 'solid' | 'ghost' }) {
  return <button data-variant={props.variant ?? 'solid'}>{props.label}</button>
}
`

const HOME_V1 = `import { Button } from '../components/Button'

export function Home() {
  return <Button label="Hello" />
}
`

const HOME_V2 = `import { Button } from '../components/Button'

export function Home() {
  return <Button label="Hello" variant="ghost" />
}
`

const CARD_V1 = `export function Card(props: { title: string }) {
  return <section><h2>{props.title}</h2></section>
}
`

/**
 * Build a small, deterministic git repo that spans a few flow layers (a page, a
 * component, a doc) with a clean two-commit history plus uncommitted work, so
 * the Files / Changes / History surfaces all have stable content to render. The
 * dir is recreated fresh each call.
 */
export async function createFixtureRepo(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  git(dir, 'init', '-b', 'main')

  await writeFixtureFile(dir, 'README.md', '# Demo\n\nA fixture repo for Porcelain e2e tests.\n')
  await writeFixtureFile(dir, 'src/components/Button.tsx', BUTTON_V1)
  await writeFixtureFile(dir, 'src/pages/Home.tsx', HOME_V1)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', 'feat: initial demo app')

  await writeFixtureFile(dir, 'src/components/Button.tsx', BUTTON_V2)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', 'feat(button): add a variant prop')

  // Uncommitted work: one modified tracked file + one new untracked file, so the
  // Changes tab shows entries across two flow layers.
  await writeFixtureFile(dir, 'src/pages/Home.tsx', HOME_V2)
  await writeFixtureFile(dir, 'src/components/Card.tsx', CARD_V1)
}
