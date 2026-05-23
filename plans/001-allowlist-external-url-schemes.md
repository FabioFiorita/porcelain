# Plan 001: Allowlist external-URL schemes before `shell.openExternal`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 864f014..HEAD -- src/main/index.ts src/renderer/src/components/viewer/markdown-view.tsx`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `864f014`, 2026-06-12

## Why this matters

Porcelain's core use case is opening arbitrary (possibly untrusted) git repos to
review them. When a markdown file is shown in reader mode, its links are rendered
with `target="_blank"`, which routes through the main process's
`setWindowOpenHandler` and calls `shell.openExternal(details.url)` with **no
validation of the URL scheme**. A crafted README in an untrusted repo can
therefore present a normal-looking link whose href uses a non-web scheme
(`file:`, or a custom app/protocol handler registered on the user's machine);
clicking it hands that URI straight to the OS opener. Restricting `openExternal`
to web/mail schemes closes a one-click vector while leaving every legitimate
documentation link working.

## Current state

- `src/main/index.ts` — the window open handler opens any URL unconditionally:

```56:59:src/main/index.ts
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
```

- `src/renderer/src/components/viewer/markdown-view.tsx` — repo-controlled markdown
  links are given `target="_blank"`, which triggers the handler above:

```16:24:src/renderer/src/components/viewer/markdown-view.tsx
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // window.open routes through main's setWindowOpenHandler → shell.openExternal
            a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {content}
        </Markdown>
```

- **Conventions to follow** (verified during recon):
  - Pure logic lives in its own module under `src/main/` with a sibling
    `*.test.ts`. Model the new module + test after `src/main/fuzzy.ts` /
    `src/main/fuzzy.test.ts` (a pure function + Vitest unit test, no I/O).
  - Tests use Vitest: `import { describe, expect, it } from 'vitest'`. See
    `src/main/repo-config.test.ts` for the exact import/describe/it style.
  - Strict TypeScript: no `any`, no `as unknown as` casts, no dead/commented-out
    code. The repo's user rule also forbids explanatory code comments — keep the
    new code comment-free except a single short doc comment matching the style of
    the existing `/** ... */` headers in `src/main/fuzzy.ts`.
  - Conventional Commits (`fix:` here, since this is a security fix).

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `pnpm install`                         | exit 0              |
| Typecheck | `pnpm typecheck`                       | exit 0, no errors   |
| Test (one)| `pnpm test src/main/external-url.test.ts` | all pass         |
| Test (all)| `pnpm test`                            | all pass (≥56 + new)|
| Lint      | `pnpm lint`                            | exit 0              |
| Build     | `pnpm build`                           | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/main/external-url.ts` (create)
- `src/main/external-url.test.ts` (create)
- `src/main/index.ts` (modify only the `setWindowOpenHandler` callback)

**Out of scope** (do NOT touch):
- `src/renderer/src/components/viewer/markdown-view.tsx` — the `target="_blank"`
  behavior stays; the fix belongs in main where the privileged API is called.
- Any other `shell.*` usage. `shell.showItemInFolder` (`revealInFinder` in
  `api.ts`) operates on local paths the renderer already controls and is out of
  scope.

## Git workflow

- Branch: `advisor/001-allowlist-external-url-schemes`
- One commit; message style (conventional commits, from `git log`):
  `fix: only open http/https/mailto links externally`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a pure `isSafeExternalUrl` helper

Create `src/main/external-url.ts` exporting a pure function that returns `true`
only for the web/mail schemes a documentation link legitimately uses. Parse with
the `URL` constructor (so malformed input is rejected, not thrown):

```ts
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** True only for web/mail URLs safe to hand to the OS opener. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Cover the helper with unit tests

Create `src/main/external-url.test.ts`, modeled structurally on
`src/main/fuzzy.test.ts`. Cover at minimum:

- returns `true` for `https://example.com`, `http://example.com/path?q=1`,
  and `mailto:a@b.com`
- returns `false` for `file:///etc/passwd`
- returns `false` for a custom-scheme URL such as `ldap://host/x` (any non-allowlisted scheme)
- returns `false` for malformed input such as `'not a url'` and the empty string

**Verify**: `pnpm test src/main/external-url.test.ts` → all pass.

### Step 3: Gate `shell.openExternal` on the helper

In `src/main/index.ts`, import the helper and only open when it passes; otherwise
deny silently. Add `isSafeExternalUrl` to the existing import block at the top of
the file (do not add an inline import).

Target shape for the callback:

```ts
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })
```

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

## Test plan

- New file `src/main/external-url.test.ts` covering the cases in Step 2 (allowed
  web/mail schemes pass; `file:`, custom schemes, and malformed input fail).
- Structural pattern: `src/main/fuzzy.test.ts`.
- Verification: `pnpm test` → all prior tests still pass plus the new cases.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0; `src/main/external-url.test.ts` exists and passes
- [ ] `pnpm build` exits 0
- [ ] `src/main/index.ts` calls `shell.openExternal` only inside an
      `isSafeExternalUrl(...)` guard
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `setWindowOpenHandler` block in `src/main/index.ts` no longer matches the
  "Current state" excerpt (the file drifted).
- You discover other renderer surfaces (besides markdown links) that open
  external URLs and would need the same guard — report them rather than expanding
  scope.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- If a future feature needs to open a new legitimate scheme (e.g. `vscode:`),
  extend `ALLOWED_PROTOCOLS` deliberately and add a test — don't widen it to
  "anything but file:".
- A reviewer should confirm the guard is in main (the privileged boundary), not
  only in the renderer where it could be bypassed.
