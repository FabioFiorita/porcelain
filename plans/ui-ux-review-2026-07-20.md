# Porcelain UI/UX review — 2026-07-20

Full-app opportunity review after the Agent/Feature batch (P1–P7).  
Not an implementation plan — a ranked backlog of **recommendability** work.

**Lens:** Would you hand this to a teammate after one session? Surfaces are strong; friction is mostly **vocabulary**, **wrong handoffs**, and **missing “what next?”**

---

## Theme (one sentence)

Make the agentic loop obvious in the chrome: **Agent → Changes → Review → Commit**, with one name per idea and a clear next step when the agent goes idle.

---

## P0 — Fix now (cheap / trust-breaking)

| ID | Opportunity | Why it matters |
|----|-------------|----------------|
| **U1** | **Empty-viewer quick-start maps “Review changes” → ⌘4 (Feature)** | Changes is ⌘3. Trains the wrong map on the most common blank surface. |
| **U2** | **Two products both called “Review”** | Agent **Review** (Feature canvas) vs continuous **Review all** (Changes). Same word, different jobs. |
| **U3** | **Glance “changed files” opens Feature** | With dirty tree but no review set → “No review yet” instead of working-tree review. Phone path actively misroutes. |

---

## P1 — High impact on “would I recommend this?”

| ID | Opportunity | Why it matters |
|----|-------------|----------------|
| **U4** | **Close-the-loop after agent idle** | Turn ends → quiet strip only. Need: N files changed · Open Changes · Open Review (if set). Without this, Porcelain is “agent chat + clever sidebar.” |
| **U5** | **One product noun for the Review** | Rail Feature / panel Feature review / Open Review / tab Review / companion Reading = four names. Pick **Review** (or Feature) end-to-end. |
| **U6** | **Desktop empty = Glance-like home** | Phone gets threads/inbox/dirty count; desktop gets logo + three chords. Port Glance signals under quick-start. |
| **U7** | **First-run copy still “diff viewer”** | Welcome/empty still *“Review changes as a story.”* Product is agent hub; tagline should say run agents + review as a story. |
| **U8** | **Feature empty + Reading companion when no review** | Outline is CLI jargon; right rail is Comments-only void. Mirror viewer’s copy-prompt empty in the companion. |
| **U9** | **Attention: Agent completion + dirty Changes** | Unread dots skip Agent; no rail cue when tree becomes dirty after a turn. Apps you recommend don’t make you poll. |
| **U10** | **Agent Files → diffs / Changes** | Session Files open preview only. “What changed?” needs Open diff / “Show in Changes.” |

---

## P2 — Core loop friction (daily papercuts)

| ID | Opportunity | Direction |
|----|-------------|-----------|
| **U11** | Feature outline opens **file** for changed files; Changes opens **diff** | Align: primary open = diff for `changed`, file secondary. |
| **U12** | Ship path is Changes-only after Feature review | “Commit these changes” / handoff to Commit when review progress is done. |
| **U13** | Freeform canvas **replaces** structured walkthrough | Dual mode or tab: board + document; outline jumps still meaningful. |
| **U14** | Continuous “Review all” has no chrome | Thin header: scope · N files · reviewed progress. |
| **U15** | Review inbox only on Feature | Badge on worktree chip / Agent; inbox “open in new window.” |
| **U16** | Preview vs sticky pin overloaded | Two “pins”; italic-only preview. Language: “Keep open” vs “Pin left.” |
| **U17** | Triple naming rail ≠ panel ≠ companion | Files/Explorer/Workspace, Changes/Source control/Commit — one noun each. |
| **U18** | Board kills entire right rail | Board companion or soft collapse — not a missing panel. |
| **U19** | Commit composer armed on clean tree | Disable primary actions + “Working tree clean.” |
| **U20** | Worktree footer shows count, not identity | Show current worktree leaf name; count in tooltip. |

---

## P3 — Polish & discovery

| ID | Opportunity |
|----|-------------|
| **U21** | Find-in-file weak; missing on diffs / Review document |
| **U22** | Split-pane focus under-signaled |
| **U23** | Zen (Z) / J/K undiscoverable |
| **U24** | Settings only on rail footer (hard once repo open) |
| **U25** | ⌘K vs ⌘P both advertised for finder |
| **U26** | Chat empty leads with CLI; Agent chat vs Agent threads naming |
| **U27** | Terminal view has no session chrome (name/cwd/exit) |
| **U28** | Commit list basenames only (`index.ts` collisions) |
| **U29** | Loading states flat “Loading…” (shared skeleton recipe) |
| **U30** | File finder empty query = blank (recents + top actions) |
| **U31** | Unsaved: no dirty tab indicator |
| **U32** | Env: “this Mac” copy; optional local chip when multi-env |
| **U33** | Project avatar = single letter only |

---

## What’s already strong (do not regress)

- Per-window environments + welcome identity + Remote chip  
- Agentic rail order (Files → Agent → Changes → Feature → …)  
- Feature outline header (Open Review, Clear in menu, evidence up top) after P7  
- Agent Active/Recent/Archive, live pulse, Session floor  
- Phone Glance as companion home  
- Flow-ordered Changes; daemon-owned threads  
- Deliberate Feature ≠ git clone (P7)

---

## Suggested implementation waves

### Wave A — Trust fixes (½–1 day)
U1, U2 labels (copy only), U3 Glance routing.

### Wave B — Loop handoffs (2–4 days)
U4 idle next-step, U5 rename pass, U6 desktop Glance, U9 attention dots, U10 Session → diff.

### Wave C — Review depth (3–5 days)
U8/U11/U12/U13/U14/U15 Feature + continuous review + inbox placement.

### Wave D — Chrome consistency (ongoing)
U16–U20, then P3 polish by pain.

---

## Relation to earlier list

| Old | Status |
|-----|--------|
| P0 Env switch | Still needs human Mac↔remote proof |
| P1–P5, P7 | Shipped (bb77665 + prior) |
| P6 Broader polish | **This document** expands it |

---

## Implementation status

| Wave | Status |
|------|--------|
| **A** U1–U3 | **Shipped** (2026-07-20) — empty-viewer chords; Glance dual rows; desktop Glance; naming start |
| **B** U4–U10 | **Shipped** (2026-07-20) — idle Next strip; Review noun on rail; Agent/Changes unread; Session→diff; companion empty; tagline |
| **C** | **Shipped** — outline→diff; continuous chrome; Board\|Document under Intent; **U12** Commit handoff from Review at ≥50% reviewed; **U15** worktree-chip badge + Agent cue (hands off to Review) + inbox open-in-new-window |
| **D** | **Shipped** — commit soft when clean; board right rail; worktree identity; **U16** Keep open / Pin left |

Product model after 2026-07-21: Review canvas is **Intent / Execution / Evidence** (not Overview \| Loop evidence). Sidebar = Open Review + file outline only.

P3 (find-in-diffs, zen discoverability, dirty tabs, etc.) remains optional polish.
