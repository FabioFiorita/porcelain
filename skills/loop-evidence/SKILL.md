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

## Preferred flow — files on disk (NOT MCP payloads)

**Do not push large HTML or base64 screenshots through `set_loop_evidence`.** That is slow, interruptible, and was the failure mode that made sessions look stuck for minutes.

The **directory is the source of truth**. Write files with your normal Write tools:

1. Call `set_loop_evidence` with **only** `{ repoPath, title }` (no `html`, no `htmlFile`).
2. The tool returns an absolute directory path, e.g.  
   `~/.porcelain/loop-evidence/<key>/`
3. Write into that directory:
   - **`index.html`** — the document (required for Porcelain to show the opener)
   - **screenshots** as real image files next to it (`shot.png`, …) with  
     `<img src="shot.png">` (relative paths — Porcelain inlines them for the sandboxed viewer; a browser opening `index.html` works too)
   - optional: you can ignore `meta.json` (the prepare step already wrote title)
4. Done. Porcelain discovers the directory within a few seconds (Feature tab → **Loop evidence**). No second MCP call with the HTML. You can also open `index.html` from the Files tree (or any `.html` file) — Porcelain has a built-in sandboxed **Preview** for HTML (toggle Source for the raw file).

`repoPath` = absolute path of the repo you're working in (your cwd).

Optional helpers:

- `get_loop_evidence` — confirm the dir / title / size (not the full HTML).
- `clear_loop_evidence` — remove the directory (prefer letting the human clear after review).

### Optional: small docs only

If the document is tiny (no screenshots), you may still pass `html` or `htmlFile` to `set_loop_evidence` and it will write `index.html` for you. **Never** use that path for multi-screenshot evidence.

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

- `index.html` exists in the directory returned by prepare.
- Relative images resolve; pass/fail is obvious.
- You actually ran the validation — don't invent evidence.

Only after that pass: tell the human the evidence is ready (Feature tab → **Loop evidence**, or open `index.html` in a browser). They clear it when finished reviewing.
