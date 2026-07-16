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

## When to use

- After a "close the loop" run: you started the dev server / opened the app / drove the iOS simulator, validated the change, and need to show the human the result without them re-running everything.
- When the human asks for proof, screenshots, or "show me it works."
- Prefer this over dumping base64 screenshots into chat — Porcelain is the place they review the feature.

## How

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `set_loop_evidence` — `{ repoPath, title, html }` → author/replace the evidence.
- `get_loop_evidence` — `{ repoPath }` → check whether one exists (title, size, when set — not the full HTML).
- `clear_loop_evidence` — `{ repoPath }` → remove it (prefer letting the human clear after review; only clear yourself when asked or when replacing with a fresh validation).

## Authoring the HTML — same sandbox rules as feature artifacts

Porcelain renders your HTML in a **FULLY SANDBOXED iframe**:

- **Scripts NEVER run.** `<script>` is inert.
- **External resources NEVER load.** No CDN, remote images, web fonts, or `fetch`.

So the document must be **ONE self-contained file**:

- **Inline all CSS** in a `<style>` tag.
- **Screenshots = `data:` URIs** (e.g. `<img src="data:image/png;base64,…">`). Prefer compressed PNGs/JPEGs; keep total HTML under ~1.5 MB.
- **Diagrams** (if any) = inline `<svg>`.
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

## Recommended structure

1. **Title + overall status** at the top (`PASS` / `FAIL` / partial).
2. **What I ran** — commands, URLs, simulator target, env.
3. **Steps** — ordered checklist of validations (each pass/fail + short note).
4. **Evidence** — screenshots as data URIs, key log lines (trimmed), console output if it proves the bug/fix.
5. **What's left** (if partial) — anything the human still needs to check by hand.

Keep it scannable: the human should know in five seconds whether the loop closed.

## Review before you say you're done

- Self-contained / sandbox-safe (no scripts, no remote assets).
- Under ~1.5 MB; shrink images if needed.
- Pass/fail is obvious; screenshots are readable (not tiny or stretched).
- You actually ran the validation — don't invent evidence.

Only after that pass: tell the human the evidence is ready (Feature tab → **Loop evidence**). They clear it when finished reviewing.
