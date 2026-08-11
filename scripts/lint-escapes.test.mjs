#!/usr/bin/env node
/**
 * Regression tests for lint-escapes ownership roots and pattern detection.
 * Temporary fixture trees prove Web/daemon/mobile coverage cannot silently drop.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  ALLOWED_FILES_REL,
  BOUNDARY_MODULE_REL,
  checkEscapes,
  FORBIDDEN,
  NAMED_PROMISE_BOUNDARIES,
  SCAN_ROOTS,
  VENDORED_UI_REL,
} from './lint-escapes.mjs'

/**
 * The real boundary module, written into every fixture repo. Boundary names only
 * disarm the rule when they resolve HERE, so fixtures must import them like
 * production does.
 */
const BOUNDARY_SOURCE = `export function settleBackground(p: Promise<unknown>, reason: string): void {
  p.catch((error: unknown) => {
    console.debug(reason, error)
  })
}
export function runUserAction(
  work: () => PromiseLike<unknown>,
  onError: (e: unknown) => void,
): void {
  Promise.resolve(work()).catch(onError)
}
`

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

/** Minimal monorepo skeleton so every SCAN_ROOT exists. */
function scaffoldOwnershipRoots(root, extras = {}) {
  for (const rel of SCAN_ROOTS) {
    writeFixtureFile(root, path.join(rel, 'ok.ts'), extras[rel] ?? 'export const ok = 1\n')
  }
  // Allowlist paths must exist or checkEscapes errors.
  for (const rel of ALLOWED_FILES_REL) {
    writeFixtureFile(root, rel, 'export {}\n')
  }
  // Every fixture gets the one real boundary module to import from.
  writeFixtureFile(root, BOUNDARY_MODULE_REL, BOUNDARY_SOURCE)
  // Vendored UI skip target (empty dir is enough).
  mkdirSync(path.join(root, VENDORED_UI_REL), { recursive: true })
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-escapes-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('SCAN_ROOTS includes web, daemon, and mobile ownership trees', () => {
  const joined = SCAN_ROOTS.join('\n')
  assert.match(joined, /apps\/web\//)
  assert.match(joined, /apps\/daemon\//)
  assert.match(joined, /apps\/mobile\//)
  assert.match(joined, /apps\/desktop\//)
})

test('desktop-only roots are rejected by the meta ownership assertion', () => {
  // Historical failure mode: renderer moved to apps/web but scan stayed on desktop shell.
  const desktopOnly = ['apps/desktop/src', 'apps/mobile/src']
  const hasWeb = SCAN_ROOTS.some((r) => r.includes('apps/web'))
  const onlyDesktopShell =
    SCAN_ROOTS.length === desktopOnly.length && desktopOnly.every((r) => SCAN_ROOTS.includes(r))
  assert.equal(hasWeb, true, 'SCAN_ROOTS must include apps/web after the renderer split')
  assert.equal(onlyDesktopShell, false, 'SCAN_ROOTS must not be desktop+mobile only')
})

test('void regex catches identifier call and parenthesized IIFE forms', () => {
  const voidRule = FORBIDDEN.find((r) => r.label.includes('void on a promise'))
  assert.ok(voidRule)
  assert.equal(voidRule.re.test('void fetchStuff()'), true)
  assert.equal(voidRule.re.test('void options.queryClient.invalidateQueries({'), true)
  assert.equal(voidRule.re.test('void (async () => {})()'), true)
  assert.equal(voidRule.re.test('void (maybe as Promise<void>).then(() => {})'), true)
  // Type positions must stay quiet.
  assert.equal(voidRule.re.test('function f(): void {'), false)
  assert.equal(voidRule.re.test('Promise<void>'), false)
  assert.equal(voidRule.re.test('const x: void = undefined'), false)
})

test('good fixture under all ownership roots exits clean', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.deepEqual(hits, [])
    },
  )
})

test('Web void identifier call is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': 'export function bad() {\n  void fetchStuff()\n}\n',
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => h.file.includes('apps/web/') && /void on a promise/.test(h.label)))
    },
  )
})

test('parenthesized void is detected on Web', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': 'export function bad() {\n  void (async () => {})()\n}\n',
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => h.file.includes('apps/web/') && /void on a promise/.test(h.label)))
    },
  )
})

test('daemon double-cast is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/daemon/src': 'export const x = 1 as unknown as string\n',
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => h.file.includes('apps/daemon/') && /as unknown as/.test(h.label)))
    },
  )
})

test('allowlisted path may double-cast; sibling path may not', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      // Real allowlist file content with a double cast — must pass.
      writeFixtureFile(
        root,
        'apps/web/src/lib/terminal-touch-scroll.test.ts',
        'export const touches = [] as unknown as Touch[]\n',
      )
      // Same pattern outside allowlist — must fail.
      writeFixtureFile(
        root,
        'apps/web/src/lib/other.test.ts',
        'export const touches = [] as unknown as Touch[]\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.some((h) => h.file.endsWith('terminal-touch-scroll.test.ts')),
        false,
      )
      assert.ok(hits.some((h) => h.file.endsWith('other.test.ts')))
    },
  )
})

test('missing scan root fails closed with a clear error', () => {
  withFixtureRepo(
    (root) => {
      // Omit packages/ui/src (not created by allowlist fixtures) so the root truly vanishes.
      for (const rel of SCAN_ROOTS.filter((r) => r !== 'packages/ui/src')) {
        writeFixtureFile(root, path.join(rel, 'ok.ts'), 'export const ok = 1\n')
      }
      for (const rel of ALLOWED_FILES_REL) {
        writeFixtureFile(root, rel, 'export {}\n')
      }
    },
    (root) => {
      const { error, hits } = checkEscapes(root)
      assert.ok(error && /missing scan root/.test(error))
      assert.match(error, /packages\/ui\/src/)
      assert.deepEqual(hits, [])
    },
  )
})

test('stale allowlist path fails closed', () => {
  withFixtureRepo(
    (root) => {
      for (const rel of SCAN_ROOTS) {
        writeFixtureFile(root, path.join(rel, 'ok.ts'), 'export const ok = 1\n')
      }
      // Create only some allowlist files — leave one missing by writing nothing for renderer.test
      writeFixtureFile(root, 'apps/daemon/src/net/static-server.test.ts', 'export {}\n')
      writeFixtureFile(root, 'apps/web/src/lib/terminal-touch-scroll.test.ts', 'export {}\n')
      // deliberately omit apps/web/src/terminal/ghostty/renderer.test.ts
    },
    (root) => {
      const { error } = checkEscapes(root)
      assert.ok(error && /ALLOWED_FILES path/.test(error))
      assert.match(error, /renderer\.test\.ts/)
    },
  )
})

test('mobile-only @expo/ui ban does not fire on web', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': "import { Host } from '@expo/ui'\nexport const x = Host\n",
        'apps/mobile/src': "import { Host } from '@expo/ui'\nexport const x = Host\n",
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.some((h) => h.file.includes('apps/web/') && /@expo\/ui/.test(h.label)),
        false,
      )
      assert.ok(hits.some((h) => h.file.includes('apps/mobile/') && /@expo\/ui/.test(h.label)))
    },
  )
})

test('bare mutateAsync expression statement is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src':
          'export function bad(mark: { mutateAsync: (x: unknown) => Promise<void> }) {\n  mark.mutateAsync({ path: "a" })\n}\n',
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /bare floating Promise/.test(h.label)))
    },
  )
})

test('bare invalidateQueries (provider pattern) is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/mobile/src':
          'export function bad(queryClient: { invalidateQueries: (x: unknown) => Promise<void> }) {\n  queryClient.invalidateQueries({ queryKey: ["daemon"] })\n}\n',
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) => /bare floating Promise/.test(h.label) && /invalidateQueries/.test(h.snippet),
        ),
      )
    },
  )
})

test('inline async JSX event callback (onDrop form) is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-async-drop.tsx',
        'export function Bad() {\n  return <div onDrop={async (event) => { await attach(event) }} />\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)))
    },
  )
})

test('inline async onMouseEnter (not in a fixed name list) is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-mouse-enter.tsx',
        'export function Bad() {\n  return <button onMouseEnter={async () => { await prefetch() }} />\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)))
    },
  )
})

test('referenced async identifier event handler is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-async-identifier.tsx',
        'const handleSubmit = async (): Promise<void> => { await save() }\nexport function Bad() {\n  return <button onClick={handleSubmit} />\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)))
    },
  )
})

test('addEventListener async callback is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src':
          "export function bad(input: HTMLInputElement) {\n  input.addEventListener('change', async () => { await attach() })\n}\n",
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /addEventListener/.test(h.label)))
    },
  )
})

test('runUserAction no-op error handler is detected', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src':
          "import { runUserAction } from '@porcelain/shared/background'\nexport function bad() {\n  runUserAction(() => Promise.resolve(), () => undefined)\n}\n",
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(hits.some((h) => /no-op error handler/.test(h.label)))
    },
  )
})

test('non-event props named only* are not treated as event handlers', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/ok-only.tsx',
        'export function Ok() {\n  return <Widget onlyShow={async () => { await x() }} />\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(hits.filter((h) => /event callback|addEventListener/.test(h.label)).length, 0)
    },
  )
})

test('await, return, Promise.all, complete catch, and named boundaries pass', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `
import { runUserAction, settleBackground } from '@porcelain/shared/background'
export async function ok(mark: { mutateAsync: (x: unknown) => Promise<void> }, qc: { invalidateQueries: (x: unknown) => Promise<unknown> }) {
  await mark.mutateAsync({ path: 'a' })
  return mark.mutateAsync({ path: 'b' })
}
export async function all(mark: { mutateAsync: (x: unknown) => Promise<void> }) {
  await Promise.all([mark.mutateAsync({ path: 'a' })])
}
export function caught(mark: { mutateAsync: (x: unknown) => Promise<void> }) {
  mark.mutateAsync({ path: 'a' }).catch((error: unknown) => {
    console.error(error)
  })
}
export function settled(mark: { mutateAsync: (x: unknown) => Promise<void> }) {
  settleBackground(mark.mutateAsync({ path: 'a' }), 'invalidation')
}
export function user(mark: { mutateAsync: (x: unknown) => Promise<void> }) {
  runUserAction(() => mark.mutateAsync({ path: 'a' }), (error) => { console.error(error) })
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) =>
          /bare floating Promise|async\/Promise-returning|addEventListener|no-op error handler/.test(
            h.label,
          ),
        ).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('sync JSX calling total void action passes', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/mobile/src/ok-press.tsx',
        'export function Ok(form: { submit: () => void }) {\n  return <Button onPress={() => { form.submit() }} />\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) =>
          /async\/Promise-returning|bare floating Promise|addEventListener/.test(h.label),
        ).length,
        0,
      )
    },
  )
})

test('JSX onError / onStatusChange async are event edges (no library exclusion in JSX)', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-jsx-onerror.tsx',
        'export function Bad() {\n  return (\n    <>\n      <Widget onError={async () => { await report() }} />\n      <Session onStatusChange={async () => { await track() }} />\n    </>\n  )\n}\n',
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      const eventHits = hits.filter((h) => /async\/Promise-returning JSX event/.test(h.label))
      assert.equal(eventHits.length, 2, hits.map((h) => `${h.line}:${h.label}`).join('; '))
    },
  )
})

test('object React Query / transport lifecycle onError remains allowed', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `
export function ok() {
  return {
    onSuccess: async () => { await invalidate() },
    onError: async () => { await log() },
    onSettled: async () => { await cleanup() },
    onMutate: async () => { await snap() },
    onStatusChange: async () => { await track() },
    onTransportClosed: async () => { await close() },
  }
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => /async\/Promise-returning event callback property/.test(h.label)).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('same-name shadowing: outer async, inner sync onError passes', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/ok-shadow-onerror.tsx',
        `async function onError(): Promise<void> { await report() }
export function Ok() {
  const onError = (): void => { console.error('local') }
  return <Widget onError={onError} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => /async\/Promise-returning JSX event/.test(h.label)).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('destructured Promise-returning handler used as JSX event fails', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-destructured-handler.tsx',
        `type Props = { handleSave: () => Promise<void> }
export function Bad({ handleSave }: Props) {
  return <button onClick={handleSave} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('inferred hook-returned destructured handler used as JSX event must wrap', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-inferred-destructured-handler.tsx',
        `declare function useForm(): { submit: () => Promise<void> }
export function Bad() {
  const { submit } = useForm()
  return <button onClick={submit} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('import-typed destructured handler used as JSX event must wrap', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/types.ts',
        'export type Props = { handleSave: () => Promise<void> }\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/bad-import-typed-destructured-handler.tsx',
        `import type { Props } from './types'
export function Bad({ handleSave }: Props) {
  return <button onClick={handleSave} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /async\/Promise-returning JSX event/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('imported handler used as JSX event fails (must wrap)', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-imported-handler.tsx',
        `import { handleSubmit } from './handlers'
export function Bad() {
  return <button onClick={handleSubmit} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) =>
            /async\/Promise-returning JSX event/.test(h.label) &&
            /inline synchronous wrapper/.test(h.label),
        ),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('inline sync wrapper around total void action passes', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/ok-inline-wrapper.tsx',
        `import { runUserAction } from '@porcelain/shared/background'
import { spawnTerminal } from './terminal-actions'
export function Ok() {
  return (
    <button
      onClick={() => {
        runUserAction(() => spawnTerminal(), (error) => { console.error(error) })
      }}
    />
  )
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) =>
          /async\/Promise-returning|bare floating Promise|addEventListener|no-op error handler/.test(
            h.label,
          ),
        ).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

// --- Owner decree: `.catch(() => {})` is not disposition -----------------------

test('no-op catch handlers are rejected in every syntactic form', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `export function bad(p: Promise<void>, q: Promise<void>, r: Promise<void>) {
  p.catch(() => {})
  q.catch(() => undefined)
  r.then(() => undefined, () => {})
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      const noop = hits.filter((h) => /no-op catch handler/.test(h.label))
      assert.equal(noop.length, 3, hits.map((h) => `${h.line}:${h.label}`).join('; '))
    },
  )
})

test('a comment-only catch body is still a no-op catch', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `export function bad(p: Promise<void>) {
  p.catch(() => {
    // load failure leaves the fallback rendered
  })
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /no-op catch handler/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a catch with a real body, and settleBackground, both pass', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `import { settleBackground } from '@porcelain/shared/background'
export function ok(p: Promise<void>, q: Promise<void>) {
  p.catch((error: unknown) => {
    console.error(error)
  })
  settleBackground(q, 'invalidation')
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => /no-op catch handler|bare floating Promise/.test(h.label)).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a no-op catch does not dispose a bare floating Promise call', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `export function bad(m: { mutateAsync: (x: unknown) => Promise<void> }) {
  m.mutateAsync({ path: 'a' }).catch(() => undefined)
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /bare floating Promise/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

// --- Boundary names must resolve to the boundary module ------------------------

test('a file-local decoy named settleBackground does not disarm the rule', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `function settleBackground(_p: Promise<unknown>): void {}
export function bad(m: { mutateAsync: (x: unknown) => Promise<void> }) {
  settleBackground(m.mutateAsync({ path: 'a' }))
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => /bare floating Promise/.test(h.label)),
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('boundary names imported from the boundary module do disarm the rule', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root, {
        'apps/web/src': `import { settleBackground } from '@porcelain/shared/background'
export function ok(m: { mutateAsync: (x: unknown) => Promise<void> }) {
  settleBackground(m.mutateAsync({ path: 'a' }), 'invalidation')
}
`,
      })
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => /bare floating Promise/.test(h.label)).length,
        0,
        hits.map((h) => `${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('the boundary allowlist is exactly the two blessed dispositions', () => {
  // `applyRefresh` was a file-local helper on the global list; it is gone.
  assert.deepEqual([...NAMED_PROMISE_BOUNDARIES].sort(), ['runUserAction', 'settleBackground'])
  assert.equal(BOUNDARY_MODULE_REL, 'packages/shared/src/background.ts')
})

// --- Handler bodies are inspected, not just handler heads ----------------------

test('a wrapper body calling a Promise-returning hook result fails', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/staging.ts',
        `export function useFileStaging(): { stageFile: (path: string) => Promise<void> } {
  return { stageFile: async () => {} }
}
`,
      )
      writeFixtureFile(
        root,
        'apps/web/src/bad-wrapper-body.tsx',
        `import { useFileStaging } from './staging'
export function Bad({ path }: { path: string }) {
  const { stageFile } = useFileStaging()
  return <button onClick={() => stageFile(path)} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) =>
            /async\/Promise-returning JSX event/.test(h.label) &&
            h.file.endsWith('bad-wrapper-body.tsx'),
        ),
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a block-bodied wrapper hiding the same call fails too', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/discard.ts',
        'export function useDiscardFile(): (path: string) => Promise<void> {\n  return async () => {}\n}\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/bad-block-wrapper.tsx',
        `import { useDiscardFile } from './discard'
export function Bad({ path }: { path: string }) {
  const discardFile = useDiscardFile()
  return (
    <button
      onClick={() => {
        discardFile(path)
      }}
    />
  )
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) =>
            /async\/Promise-returning JSX event/.test(h.label) &&
            h.file.endsWith('bad-block-wrapper.tsx'),
        ),
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a wrapper around a provably void hook result passes', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/path-actions.ts',
        'export function usePathActions(): { copyPath: () => void } {\n  return { copyPath: () => {} }\n}\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/ok-void-wrapper.tsx',
        `import { usePathActions } from './path-actions'
export function Ok() {
  const { copyPath } = usePathActions()
  return <button onClick={() => { copyPath() }} onDoubleClick={copyPath} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => h.file.endsWith('ok-void-wrapper.tsx')).length,
        0,
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a wrapper body that disposes through a boundary passes', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/prefetch.ts',
        'export function usePrefetch(): (path: string) => Promise<void> {\n  return async () => {}\n}\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/ok-settled-wrapper.tsx',
        `import { settleBackground } from '@porcelain/shared/background'
import { usePrefetch } from './prefetch'
export function Ok({ path }: { path: string }) {
  const prefetch = usePrefetch()
  return <button onMouseEnter={() => { settleBackground(prefetch(path), 'invalidation') }} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => h.file.endsWith('ok-settled-wrapper.tsx')).length,
        0,
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('a type-annotation rebind cannot launder a Promise handler past the edge', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/reveal.ts',
        'export function useReveal(): { reveal: () => Promise<void> } {\n  return { reveal: async () => {} }\n}\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/bad-annotation-rebind.tsx',
        `import { useReveal } from './reveal'
export function Bad() {
  const { reveal } = useReveal()
  const handleReveal: () => void = reveal
  return <button onClick={handleReveal} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) =>
            /async\/Promise-returning JSX event/.test(h.label) &&
            h.file.endsWith('bad-annotation-rebind.tsx'),
        ),
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

// --- Array destructuring closes symmetrically with object destructuring --------

test('an array-destructured Promise handler is caught like an object-destructured one', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/saver.ts',
        'export function useSaver(): [(v: string) => Promise<void>, boolean] {\n  return [async () => {}, false]\n}\n',
      )
      writeFixtureFile(
        root,
        'apps/web/src/bad-array-destructured.tsx',
        `import { useSaver } from './saver'
export function Bad() {
  const [save] = useSaver()
  return <button onClick={save} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some(
          (h) =>
            /async\/Promise-returning JSX event/.test(h.label) &&
            h.file.endsWith('bad-array-destructured.tsx'),
        ),
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('an unresolvable array-destructured handler must wrap, like its object twin', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/bad-opaque-array.tsx',
        `declare function useThing(): [() => Promise<void>]
export function Bad() {
  const [save] = useThing()
  return <button onClick={save} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.ok(
        hits.some((h) => h.file.endsWith('bad-opaque-array.tsx')),
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})

test('React state tuples stay usable as event handlers without a wrapper', () => {
  withFixtureRepo(
    (root) => {
      scaffoldOwnershipRoots(root)
      writeFixtureFile(
        root,
        'apps/web/src/ok-use-state.tsx',
        `import { useState } from 'react'
export function Ok() {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen} />
}
`,
      )
    },
    (root) => {
      const { hits, error } = checkEscapes(root)
      assert.equal(error, undefined)
      assert.equal(
        hits.filter((h) => h.file.endsWith('ok-use-state.tsx')).length,
        0,
        hits.map((h) => `${h.file}:${h.line}:${h.label}`).join('; '),
      )
    },
  )
})
