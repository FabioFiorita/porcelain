# Evidence — "Did it actually work?"

Evidence is **ephemeral HTML proof** that you closed the loop: browser, simulator, screenshots, pass/fail. Complements Intent (idea) and Execution (code). The human clears it after review.

**End of session:** do not claim a unit done without real Evidence of what you ran. Don't invent proof. Required alongside complete Execution.

**HTML only.** Excalidraw is **not** an evidence medium (use Intent freeform for boards).

## Preferred flow — prepare, then write files

**Do not push large HTML or base64 screenshots through the CLI.**

1. `~/.porcelain/porcelain evidence prepare --title "<title>"` → prints `<repo>/.porcelain/evidence/`
2. Write into that directory:
   - **`index.html`** — the document (**must include its own CSS** — see below)
   - Optional **CSS sibling** if you prefer a separate stylesheet (`styles.css` + `<link rel="stylesheet" href="styles.css">`)
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

Fully **sandboxed** iframe (`sandbox=""` — scripts never run; no remote assets). Porcelain does **not** inject a default theme. Bare unstyled markup will look wrong in the Evidence tab.

### CSS is required — own the template

Each evidence pack styles itself. There is no shared Porcelain evidence CSS and no “default template” to rely on. Design the look for *this* unit (pass/fail report, repro diary, screenshot strip, whatever fits).

Pick **one** (or combine):

1. **Inline** — put a full `<style>…</style>` in `index.html` (safest, one file).
2. **Sibling stylesheet** — write e.g. `styles.css` next to `index.html` and link it:
   ```html
   <link rel="stylesheet" href="styles.css">
   ```
   The daemon inlines local relative stylesheets for the sandboxed viewer (same as local images). Missing or remote CSS is left as-is and **will not load**.

Do **not**:

- Omit CSS and expect readable dark UI from the app chrome
- Link CDN / `https://…` stylesheets (blocked)
- Use absolute `file:` paths
- Ship only a screenshot with no document chrome if the human needs to read steps/logs

Screenshots = sibling files + relative `src` (or data URIs if you must). Prefer system fonts. Dark-friendly colors work best against Porcelain’s shell, but the palette is yours.

Keep the folder under a few MB after screenshots (read cap **4 MB after data-URI inlining**). Over that, the Evidence tab shows **"Evidence too large (X MB > 4.0 MB)"** (title/checks still visible) — not "cleared". Shrink screenshots (e.g. JPEG ~540px) and rewrite `index.html`. `evidence get` prints a WARNING when the estimated inlined size is over the cap.

### Suggested document sections (content, not a fixed design)

Structure content however you like; a useful pack usually has:

1. Title + overall status (`PASS` / `FAIL` / partial)
2. What I ran (commands, URLs, env)
3. Steps (checklist)
4. Screenshots / key logs
5. What's left (if partial)

### Minimal self-contained skeleton (replace styles freely)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Evidence title</title>
  <!-- Either embed CSS here… -->
  <style>
    :root { color-scheme: dark; }
    body { font: 14px/1.45 system-ui, sans-serif; margin: 1.25rem; color: #e8eaed; background: #0f1115; }
    h1 { font-size: 1.15rem; margin: 0 0 0.75rem; }
    .ok { color: #6ee7a8; } .bad { color: #fca5a5; }
    pre, code { font-family: ui-monospace, monospace; font-size: 12px; }
    pre { overflow: auto; padding: 0.75rem; background: #1a1d24; border-radius: 8px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
  </style>
  <!-- …or: <link rel="stylesheet" href="styles.css"> with styles.css as a sibling -->
</head>
<body>
  <h1>… <span class="ok">PASS</span></h1>
  <!-- content + <img src="shot.png" alt="…"> -->
</body>
</html>
```

That skeleton is an example only — rewrite the CSS per review.

## Verify

```bash
~/.porcelain/porcelain evidence get
~/.porcelain/porcelain evidence clear   # prefer letting the human clear after review
```

Porcelain shows Evidence on the Review canvas **Evidence** tab.
