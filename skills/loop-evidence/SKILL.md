---
name: loop-evidence
description: Author "loop evidence" for the Porcelain app — a self-contained HTML document proving you closed the loop (browser, simulator, or other self-validation with screenshots and pass/fail steps), which Porcelain renders in the Feature tab so the human can see the final result and clear it once reviewed.
---

# Porcelain loop evidence

Porcelain can render **loop evidence**: a self-contained HTML document you author after *validating the work yourself* — open the browser, drive the simulator, capture screenshots, show pass/fail. It COMPLEMENTS the feature review set and the feature artifact:

| Surface | Role |
|---|---|
| **Feature review** (`review-with-porcelain`) | What files to read, in flow order |
| **Feature artifact** (`feature-artifact`) | Narrative/visual explainer — *how it works* |
| **Loop evidence** (this skill) | Ephemeral proof — *it works; here is what I ran and saw* |

The human opens it from the **Feature** tab → **Loop evidence**, then hits **Clear** when done (e.g. before commit/push). You do not need to keep evidence forever.

The CLI lives at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

## Preferred flow — prepare a directory, then write files into it

**Do not push large HTML or base64 screenshots through the CLI.** That is slow, interruptible, and was the failure mode that made sessions look stuck for minutes. Instead, prepare a directory and write the document + screenshots into it with your normal Write tools — the **directory is the source of truth**.

1. `~/.porcelain/porcelain evidence prepare --title "<title>"` → prints an absolute directory path, e.g.
   `~/.porcelain/loop-evidence/<key>/` (title-only; no HTML flags on `prepare`).
2. Write into that directory with your file tools:
   - **`index.html`** — the document (required for Porcelain to show the opener).
   - **screenshots** as real image files next to it (`shot.png`, …) referenced with relative `src` — `<img src="shot.png">`. Porcelain inlines them for the sandboxed viewer; a browser opening `index.html` works too.
3. Done. Porcelain discovers the directory within a few seconds (Feature tab → **Loop evidence**). No second CLI call with the HTML. You can also open `index.html` from the Files tree (or any `.html` file) — Porcelain has a built-in sandboxed **Preview** for HTML (toggle Source for the raw file).

Optional helpers:

- `~/.porcelain/porcelain evidence get` → confirm the dir / title / size (not the full HTML).
- `~/.porcelain/porcelain evidence clear` → remove the directory (prefer letting the human clear after review).

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

Keep the whole folder under a few MB after screenshots (shrink images). Porcelain drops documents over ~1.5 MB of HTML after asset inlining.

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

Only after that pass: tell the human the evidence is ready (Feature tab → **Loop evidence**, or open `index.html` in a browser). They clear it when finished reviewing.
