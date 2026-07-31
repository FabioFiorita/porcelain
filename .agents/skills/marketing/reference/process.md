# Surfaces, site mechanics & release process

## Surfaces

| Surface | What it is | Deploy |
|---|---|---|
| `README.md` | The repo front door — most traffic lands here first | push to main |
| `marketing/` | Static one-page site → https://fabiofiorita.github.io/porcelain/ | `pages.yml` auto-deploys on push when `marketing/**` changes — merging IS publishing |
| GitHub release notes / `CHANGELOG.md` | Release visibility (see `releasing` skill for the pipeline) | on release |
| Companion skills' prose (`/skills/`) | Users read these; they carry positioning too | skills.sh |

App copy is the `product` skill's domain, not this one.

## Site mechanics & traps

- `marketing/index.html` is a single self-contained page, styles inline plus
  `styles.css`; edit in place, no build step.
- **The version string is hard-coded once** in `index.html` (the "Apple
  Silicon · vX.Y.Z" line — marked with a comment). It drifts: it sat at
  v0.17.0 while the app shipped v0.32.0. Check it on every marketing pass and
  every release.
- `og:image` / `twitter:image` point at `images/feature-view.png` — replacing
  that file changes social cards; keep it the strongest single shot.
- Site copy and README must tell the same story in the same era — when one is
  refreshed, diff the other in the same pass.

## Release visibility

Competitors ship near-daily and it *reads* as momentum. Our cadence is fine;
legibility is the gap: release notes get a human-written summary line and,
when a visible surface changed, a current screenshot. The version bump on the
site (above) rides the same pass.

## Definition of done for a marketing pass

1. Claims verified against shipped code (product surfaces, era).
2. README ↔ site ↔ product skill tell one story; no transport wars, no brand lists.
3. Site version string current; og:image still the best shot.
4. Screenshots regenerated for surfaces that changed (pipeline: `reference/screenshots.md`).
5. No personal-setup leaks.
6. Normal gate: `pnpm verify` + commit (site deploys itself on push).
