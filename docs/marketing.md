# Porcelain — marketing

Open when touching `README.md`, `marketing/`, screenshots, or launch copy. Not a standing skill.

## Voice

- **Identity source:** `docs/product.md` (pillars, audience, companion not cockpit).
- Site visual: opaque graphite, solid cards — no glassmorphism or purple glow wallpaper.
- Claims must be true of the **shipped** app today. Sell review depth and Porcelain's own surfaces;
  no protocol wars, no third-party agent brand lists, no personal hostnames.
- Confident, concrete, no hype. Prefer short sentences; avoid em/en dashes as asides in user-facing
  copy.
- Landing page is timeless product copy, not a changelog ("now", "new", "no longer").

## Surfaces

| Surface | Notes |
|---------|--------|
| `README.md` | Repo front door |
| `marketing/` | Static site → GitHub Pages; merge deploys when `marketing/**` changes |
| Release notes / CHANGELOG | Human summary; screenshot when a visible surface changed |

Version string in `marketing/index.html` is hard-coded once — update on marketing/release passes.
`og:image` is `images/feature-view.png`.

## Screenshots

```bash
pnpm shots
```

Pipeline traps (blank xterm canvas, leaked hostnames, sidebar widths) used to live in a long skill
reference — when regenerating, read the shots scripts under `apps/desktop` and prior commit messages
for that path. Keep demo content generic (`you@remote-host`, not personal machines).

## Done checklist for a marketing pass

1. Claims match shipped code / `docs/product.md`.
2. README and site tell the same story.
3. Site version string current; best og shot.
4. Screenshots for changed surfaces.
5. No personal-setup leaks.
6. `pnpm verify` + commit.
