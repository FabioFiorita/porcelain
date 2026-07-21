---
name: loop-evidence
description: Author HTML evidence for Porcelain's Feature Review (proof the loop closed). This skill is a thin redirect — full guidance lives under the feature-review skill's Evidence reference.
---

# Evidence (redirect)

**Loop evidence** is now the **Evidence** tab of the Feature Review (HTML only).

Use the **`feature-review`** skill as the single home for Intent · Execution · Evidence:

- Overview + CLI flow: `feature-review/SKILL.md`
- Evidence deep dive: `feature-review/references/evidence.md`

Quick path:

```bash
~/.porcelain/porcelain evidence prepare --title "…"
# Write index.html (+ screenshots) into the printed directory
~/.porcelain/porcelain evidence check --label "…" --status pass|fail|skip [--detail "…"]
```

Do **not** use Excalidraw for evidence (removed). Freeform boards belong on **Intent** via `review set-canvas` — see `feature-review/references/excalidraw.md`.
