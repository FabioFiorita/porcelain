---
name: loop-evidence
description: Author "loop evidence" for the Porcelain app — a self-contained HTML document proving you closed the loop (browser, simulator, or other self-validation with screenshots and pass/fail steps), which Porcelain renders as the Loop evidence tab on the Review canvas so the human can see the final result and clear it once reviewed.
---

# Porcelain loop evidence

Porcelain can render **loop evidence**: a self-contained HTML document you author after *validating the work yourself* — open the browser, drive the simulator, capture screenshots, show pass/fail. It COMPLEMENTS the Review:

| Surface | Role |
|---|---|
| **The Review** (`review-with-porcelain`) | The walkthrough — what to read, in flow order, and *how it works* |
| **Loop evidence** (this skill) | Ephemeral proof — *it works; here is what I ran and saw* |

Loop evidence renders as the Review canvas **Loop evidence** tab (full height — not a chapter at the bottom of a long Overview). The body is **HTML** (default) or **Excalidraw** — pick one:

| Prefer **HTML** when… | Prefer **Excalidraw** when… |
|---|---|
| Screenshots, pass/fail reports, tables, multi-step browser proof (default) | Proof is itself a spatial diagram (rare — usually HTML) |

Write either `index.html` or `canvas.excalidraw` in the evidence directory (HTML wins if both exist). Structured checks (`evidence check`) always apply. The human reaches the tab from the Feature outline's **Loop evidence** row and hits **Clear** when done.

The CLI lives at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

## Preferred flow — prepare a directory, then write files into it

**Do not push large HTML or base64 screenshots through the CLI.** That is slow, interruptible, and was the failure mode that made sessions look stuck for minutes. Instead, prepare a directory and write the document + screenshots into it with your normal Write tools — the **directory is the source of truth**.

1. `~/.porcelain/porcelain evidence prepare --title "<title>"` → prints an absolute directory path, e.g.
   `~/.porcelain/loop-evidence/<key>/` (title-only; no HTML flags on `prepare`).
2. Write into that directory with your file tools — **one body**:
   - **HTML (default):** `index.html` + optional **screenshots** as sibling files (`shot.png`, …) with relative `src` — `<img src="shot.png">`. Porcelain inlines them for the sandboxed viewer.
   - **Excalidraw (optional):** `canvas.excalidraw` (export from Excalidraw; do not hand-type the JSON). Or `porcelain evidence set --title "…" --medium excalidraw --file ./board.excalidraw`.
3. Done. Porcelain discovers the directory within a few seconds and adds the **Loop evidence** canvas tab. No second CLI call for large HTML — write the file yourself.

Optional helpers:

- `~/.porcelain/porcelain evidence get` → confirm the dir / title / size (not the full HTML), plus the recorded checks summary.
- `~/.porcelain/porcelain evidence clear` → remove the directory (prefer letting the human clear after review).

## Structured checks — one per verification step

Alongside the HTML, record each verification step as a **structured check** so the Review shows a machine-readable pass/fail list (and a Pass/Fail badge on the evidence header) — not just prose buried in the document:

```bash
~/.porcelain/porcelain evidence check --label "pnpm lint"  --status pass --detail "0 errors"
~/.porcelain/porcelain evidence check --label "pnpm test"  --status pass --detail "1348 passed"
~/.porcelain/porcelain evidence check --label "pnpm build" --status pass --detail "tsc + vite ok"
~/.porcelain/porcelain evidence check --label "e2e login"  --status skip --detail "no display on this host"
```

- `--status` is `pass | fail | skip`. Put the **real result** in `--detail` (`1348 passed`, `2 failed`, a URL, a device) — don't invent it.
- Run one `check` per step you actually verified (lint / tests / build / e2e). It **appends**; re-running with the **same `--label`** updates that check in place (so fixing a failure and re-recording it flips fail → pass, no duplicate).
- `check` creates the evidence directory + meta on its own, so you can record checks before (or without) writing `index.html`.
- **Derived overall status:** any `fail` → overall Fail; all `pass` (at least one) → overall Pass; skip-only or empty → no badge.
- Caps: up to 32 checks, label ≤ 120 chars, detail ≤ 400 chars (over-cap is rejected loudly).

### Alternative: small docs only

If the document is tiny (no screenshots), skip `prepare` and pass the HTML directly:

```bash
~/.porcelain/porcelain evidence set --title "Login smoke test" --html-file ./evidence.html
```

`evidence set` requires the HTML (exactly one of `--html-file <path>` or `--html <s|->`, where `-` reads stdin) — `prepare` is the title-only path, no overloading. **Never** use `evidence set` for multi-screenshot evidence.

Porcelain runs a **plausibility check** on the HTML (and enforces a minimum size and size caps): junk, empty, or too-small documents are rejected loudly — fix and re-run rather than assuming it landed.

## Authoring the HTML

Porcelain renders your HTML in a **FULLY SANDBOXED iframe** (scripts never run; remote assets never load). Local sibling images with relative `src` are fine (the app inlines them).

- **Inline all CSS** in a `<style>` tag.
- **Screenshots = real files** in the evidence directory + relative `src` (preferred), or `data:` URIs if you must.
- System fonts only (`font-family: system-ui, sans-serif`).
- **Dark styling** to match Porcelain:

```html
<style>
  body { margin: 0; padding: 2rem; background: #0b0b0d; color: #e5e5e7;
         font-family: system-ui, sans-serif; line-height: 1.6; }
  h1, h2 { color: #fff; }
  .pass { color: #86efac; } .fail { color: #fca5a5; }
  table { border-collapse: collapse; } td, th { border: 1px solid #2a2a2e; padding: .4rem .6rem; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
</style>
```

Keep the whole folder under a few MB after screenshots (shrink images). Porcelain reads up to ~4 MB of HTML **after** it inlines the sibling screenshots as data URIs (documents over that are dropped) — so a handful of reasonably-sized screenshots is fine, but don't dump giant unshrunk PNGs.

## Recommended structure

1. **Title + overall status** at the top (`PASS` / `FAIL` / partial).
2. **What I ran** — commands, URLs, simulator target, env.
3. **Steps** — ordered checklist of validations (each pass/fail + short note).
4. **Evidence** — screenshots (sibling files), key log lines (trimmed).
5. **What's left** (if partial) — anything the human still needs to check by hand.

## Review before you say you're done

- `index.html` exists in the directory returned by `prepare`.
- Relative images resolve; pass/fail is obvious.
- You actually ran the validation — don't invent evidence.

Only after that pass: tell the human the evidence is ready (Review canvas → **Loop evidence** tab in the Feature tab, or open `index.html` in a browser). They clear it when finished reviewing.
