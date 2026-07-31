---
name: marketing
metadata:
  internal: true
description: Own the marketing process end-to-end — README, marketing site, screenshots, release visibility. Read before touching README.md, marketing/, or producing screenshots/launch copy.
---

# Porcelain — marketing

The agent owns this whole process. The maintainer is a **stakeholder** (reviews
outcomes, answers judgment questions), not a production step — do not park work
on "waiting for a screenshot from the user". The one deliberate exception is
listed under Screenshots.

This file is a router: recipes, checklists, and site mechanics live in
`reference/`. The voice and positioning rules below are always-on — read them
even for a one-line copy change.

## Message discipline

- **Source of truth for identity:** the `product` skill (identity line, pillars,
  audience). Keep README, site, and CLAUDE.md one-liners in the same era.
- **Site visual identity:** opaque graphite, solid cards, no glassmorphism —
  match the app's reading-room redesign (`marketing/styles.css`). Do not
  reintroduce backdrop-blur glass tiles or purple glow wallpaper.
- Every marketing claim must be true of the shipped app **today** — verify
  against the code/`product` skill before writing, not from memory. Known
  drift class to check each pass: the positioning era (**focused review
  companion**, not hub / cockpit / "have it all" — agents run where the user
  already runs them; Porcelain does not host them); short taglines in
  `package.json`, welcome/empty-viewer subtitles, `manifest.webmanifest`, and
  the GitHub repo description (they have shipped hub-era copy like "Run
  agents" / "Hub for agentic coding" before). **Sell Porcelain's surfaces**,
  not transport: no "Local CLI, not MCP", no protocol wars, no
  "no port" as a hero claim. Privacy is "on your machines / no cloud / no
  telemetry" when it matters. Install can name the companion skill and the
  local `porcelain` command once. **Do not list third-party agent product
  names** in taglines, heroes, or GitHub description. Say "your agents" /
  "the tools you already use."
- Voice: confident, concrete, zero hype adjectives. Sell *legible* (the
  reading room), not "blazing fast AI-powered". Competitors' angle is breadth
  and velocity; ours is trust and review depth. Don't copy their voice.
- **No em dashes (—) or en dashes (–) as asides.** They read as AI-generated.
  Prefer short sentences, commas, colons, or parentheses. Reorganize the idea
  instead of gluing a parenthetical with a dash. Applies to the site, README,
  and launch copy. HTML/CSS comments are fine.
- **Never leak the personal setup** (CLAUDE.md rule): no beelink, no
  soaphealth, no personal hostnames in anything user-visible. Demo content
  uses generic names.
- **The landing page is a SELLING page, not a changelog:** never use update
  framing ("X runs inside Porcelain **now**", "new", "no longer") — new users
  have no memory of previous versions. Describe the product timelessly, as it
  is. Industry-shift framing ("Agents write the code now") is fine;
  product-delta framing is not.

## Reference

| File | Read it when |
|---|---|
| `reference/screenshots.md` | Regenerating marketing screenshots — the `pnpm shots` pipeline and its traps (blank xterm canvas, leaked hostnames, sidebar-width phases). |
| `reference/process.md` | Touching README/site/release notes or closing out a pass — surface map, site traps, done checklist. |
