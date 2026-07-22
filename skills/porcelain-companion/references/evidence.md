# Evidence — "Did it actually work?"

Evidence is **ephemeral HTML proof** that you closed the loop: browser, simulator, screenshots, pass/fail. Complements Intent (idea) and Execution (code). The human clears it after review.

**HTML only.** Excalidraw is **not** an evidence medium (use Intent freeform for boards).

## Preferred flow — prepare, then write files

**Do not push large HTML or base64 screenshots through the CLI.**

1. `~/.porcelain/porcelain evidence prepare --title "<title>"` → prints `~/.porcelain/loop-evidence/<key>/`
2. Write into that directory:
   - **`index.html`** — the document
   - Optional screenshots as siblings with relative `src` (`<img src="shot.png">`)
3. Record structured checks:

```bash
~/.porcelain/porcelain evidence check --label "pnpm lint"  --status pass --detail "0 errors"
~/.porcelain/porcelain evidence check --label "pnpm test"  --status pass --detail "1348 passed"
~/.porcelain/porcelain evidence check --label "e2e login"  --status skip --detail "no display"
```

- `--status`: `pass | fail | skip`. Same `--label` updates in place.
- Overall: any fail → Fail; all pass (≥1) → Pass; skip-only → no badge.
- Caps: 32 checks, label ≤ 120, detail ≤ 400.

### Small docs only

```bash
~/.porcelain/porcelain evidence set --title "Login smoke" --html-file ./evidence.html
```

Exactly one of `--html-file` or `--html` (`-` = stdin). Never for multi-screenshot packs.

## Authoring HTML

Fully **sandboxed** iframe (`sandbox=""` — scripts never run; no remote assets).

- Inline all CSS in `<style>`.
- Screenshots = sibling files + relative `src` (or data URIs if you must).
- System fonts; dark styling to match Porcelain.
- Keep the folder under a few MB after screenshots (read cap **4 MB after data-URI inlining**). Over that, the Evidence tab shows **"Evidence too large (X MB > 4.0 MB)"** (title/checks still visible) — not "cleared". Shrink screenshots (e.g. JPEG ~540px) and rewrite `index.html`. `evidence get` prints a WARNING when the estimated inlined size is over the cap.

### Recommended structure

1. Title + overall status (`PASS` / `FAIL` / partial)
2. What I ran (commands, URLs, env)
3. Steps (checklist)
4. Screenshots / key logs
5. What's left (if partial)

## Verify

```bash
~/.porcelain/porcelain evidence get
~/.porcelain/porcelain evidence clear   # prefer letting the human clear after review
```

Porcelain shows Evidence on the Feature canvas **Evidence** tab; sidebar shortcut uses the title.
