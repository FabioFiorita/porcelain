# Launch narrative: Porcelain

**Ground truth for public words** — X, Product Hunt, HN, emails, podcasts, maker comments.  
**Product facts:** shipped app + `.agents/skills/product/SKILL.md`  
**Strategy / non-goals / roadmap status:** `plans/positioning-and-roadmap.md`  
**Identity (never dilute):** *Porcelain is where agent work becomes trusted work.*

Do not invent features. Claims must be true of the app **today**. Website copy is timeless (no “now / new / no longer”); launch posts may tell the journey once.

---

## One-liner

**Where agent work becomes trusted work.**

### Variants

| Context | Line |
|---------|------|
| Product Hunt tagline | Your agents run in your terminal. Review what they built as a story, not a file list. |
| X bio / short | The review layer for agentic coding: read what your agents built as a story, trust what ships. |
| HN | Porcelain: review agent-written features as a story, not an alphabetical diff |
| Subtitle | Mac app or any browser. Your CLIs. Local only. Open source. |

---

## 15-second pitch

Everyone is racing to spawn more coding agents. Porcelain stands on the other side of the pile. Your agents keep running where they always have, in your terminal, on the CLIs you already pay for. Porcelain is the one lightweight window where you **review** what they built the way a senior engineer reads a feature: as a story, not an alphabetical dump of files. Trust is the product.

---

## 60-second pitch

The bottleneck moved from writing code to understanding agent-written code. Editors are for authoring. Git UIs are flat file lists. New agent cockpits grow the unreviewed pile.

Porcelain is not an IDE and not a cockpit. It is the place agent work turns into something you have actually read:

1. **The Review** — Intent, Execution, Evidence: idea, flow-ordered walkthrough (including the other half of the client/server seam), proof it verified its work.
2. **Flow-ordered diffs** — even without a Review, changes read from entry point to data.
3. **A closed human↔agent loop** — line comments, board, local CLI and companion skills. No MCP port, no telemetry.
4. **Remote as a product** — one daemon; the Mac app local, the Mac app pointed at a remote environment, or any browser including on mobile. State lives on the host you own.

Your agents run in a terminal, yours or the one embedded next to the review surfaces. Open source. Free. Your agent subscriptions, your machines.

---

## Philosophy (ground truth for threads & PH)

### Origin (your arc, usable once in launch posts)

Porcelain started as a **companion** next to Codex, Claude in a terminal, or similar: a place to **see files and diffs** and understand what the agent did. Then git actions, history, search, a project board. The **terminal** was a break: agents were supposed to stay outside, then running them in the same window won. A second machine (Mac as seat, Linux as power) forced **environments** and a real remote daemon. Then came a detour: reimplementing the agent CLIs inside the app. It lasted sixteen days and got cut, because the thing that makes Porcelain worth using was never who launched the agent. It was the Review.

The product got bigger, then got cut back. The soul never moved: **humans must still understand and trust agent work.** The job is a **unique vision** of that trust loop, not another multi-agent cockpit.

### What we believe

- **Trust over velocity.** More unreviewed agent output is not progress.
- **Story over soup.** A feature is a path through the stack, not A–Z paths.
- **Connected homes, not silos.** Deep work has one home (Changes, Review, Files, Board, Terminal); other surfaces may preview and must hand off.
- **Viewer, not editor.** Lightweight wins. The IDE stays the IDE.
- **Opaque and serious, not glassy.** Calm chrome; sans for UI/prose; mono for code. Do not sell “glass” or “AI-powered.”
- **Local by default.** Channels are files + a bundled CLI on your machine. No Porcelain cloud for your code. No telemetry.
- **Deep review, no agent runner.** Porcelain runs no agent. Whatever you run in your terminal feeds the same Review through the same CLI.
- **CLI, not MCP.** Agent channel is `~/.porcelain/porcelain` (local files, no port). Companion skills teach the workflow.

### Two pillars (always this order)

1. **Review depth** (the moat) — the Review, flow-ordered diffs, comments both ways, explore-a-flow, monorepo hide/pin, loop evidence.
2. **Remote as a product** (second moat) — one token-gated daemon; three clients; state and PTYs daemon-side.

There is no third. Running agents was one until 2026-07-27; the in-app runner is gone.

### Non-goals (when someone asks “why not X?”)

- Running the agent for you (no in-app agent runner)  
- Agent-to-agent chat relays and file-claim coordination  
- Provider-count race  
- Cross-provider hand-off theater  
- Scheduled automations / built-in browser as core  
- Becoming an editor  
- A desktop download beyond macOS: on Linux (or Windows) you run the daemon on the machine that holds the code and open it in a browser — same client, no install  
- Windows-native app first (browser covers other clients)  
- Shipping “iPad app” messaging (there is none: **browser on mobile**)  
- Competing on YouTube-driven star counts. Compete on **retention of reviewers**  
- PR create / PR review until real demand  

### Competitive frame

| | Agent cockpits | Porcelain |
|--|----------------|-----------|
| Center | Spawn & steer | Understand & trust |
| Review | Diff / PR-shaped | Story + whole feature + evidence |
| Remote | Plumbing / later | First-class product |
| Agents | Runs and counts them | Runs none; yours run in your terminal |
| Integration | Chat / MCP | Local CLI + skills, two-way |

---

## Who it is for

**Primary:** Engineers already serious about coding agents (Claude Code, Codex, OpenCode, Grok, whatever they run) who feel the bottleneck is **reading and trusting**, often in monorepos, often with a second machine as compute.

**Secondary:** Home server / cloud box as power; laptop or phone **browser** as the seat.

**Not yet:** Non-engineers; teams whose center of gravity is Enterprise PR workflow; people who want AI so they never look at code.

---

## Benefits (marketing order — do not reshuffle casually)

1. Trust, not just velocity  
2. The Review (document, not pile): Intent · Execution · Evidence  
3. Flow-ordered diffs  
4. Closed human↔agent loop (comments, board, CLI)  
5. One workspace (terminal next to the review surfaces)  
6. Anywhere is the same place (remote / daemon / browser)  
7. Huge repos stay usable (hide / pin)  
8. Open, local, free  

### The board (do not conflate with review comments)

- **Board** — plan in the same window you ship from. To Do / Doing / Done; agents move cards via CLI.  
- **Review comments** — notes on a line or file in work that already exists. Different job, different surface.

### Agents (today)

Porcelain runs none. Claude Code, Codex, OpenCode, Grok, or anything else runs in your terminal, on the CLIs and subscriptions you already have, and publishes the Review through the bundled porcelain CLI.

---

## X / Twitter

### Thread skeleton

1. **Hook:** Agents write code faster than anyone can trust it. Porcelain is where that work becomes trusted work.  
2. **Problem:** Editors are heavy for reading. Git UIs are alphabetical. Cockpits spawn more agents → bigger unreviewed pile.  
3. **Hero:** The Review (Intent · Execution · Evidence). Screenshot.  
4. **Flow:** Diffs ordered like the runtime path. Screenshot.  
5. **Loop:** Comment on a line → agent resolves. Local CLI, no port.  
6. **Board:** Plan in the same window you ship from; agents move cards via the CLI.  
7. **Terminal:** Your agent runs right next to the review surfaces. Your CLIs, your subscriptions.  
8. **Remote:** `npx porcelain-daemon@latest serve` → app or any browser (including mobile) to a machine you own.  
9. **Close:** Open source · MIT · macOS app + any browser · no telemetry. Link + `npx skills add FabioFiorita/porcelain`.  
10. **CTA:** Star, download, or say what you review first.

Tone: calm, concrete, zero hype. Screenshots of the **current opaque** UI.

### Single posts

**Launch day:**  
Porcelain is out: where agent work becomes trusted work. Your agents keep running in your terminal. Porcelain is where you review the whole feature as a story (Intent → Execution → Evidence). Local CLI, remote daemon, open source.  
[link]

**Philosophy:**  
I built Porcelain because I stopped believing “more agents” was the hard part. The hard part is still understanding what shipped. So: a place to trust agent work, not another cockpit dashboard.

**Remote:**  
My laptop is a thin client. Terminals and review state live on a box I own. Porcelain is one daemon, three clients (app, remote env, any browser). Same review state after reconnect.

---

## Product Hunt

| Asset | Content |
|-------|---------|
| Name | Porcelain |
| Tagline | Where agent work becomes trusted work |
| Description (~260 chars) | The review layer for agentic coding: your agents run in your terminal, Porcelain is where you read what they built as a feature story (Intent, Execution, Evidence), not a file list. Mac app or any browser. |
| Gallery | 1) Review hero 2) Flow Changes 3) Comment 4) Board 5) Terminal + Actions 6) Remote install one-liner |
| First comment | Origin + three beliefs + skills install + not an IDE |
| Topics | Developer Tools, AI, Productivity, Open Source, Git |

### First comment (template)

Hey PH. I’m Fabio.

Porcelain started as a place to **read** what coding agents did, and that is still exactly what it is. My agents run in a terminal. Remotes connect my laptop to a bigger machine. The agent publishes a **Review** so I can sign off on a whole feature, not an alphabetical diff.

Three beliefs:

1. Trust over velocity  
2. Story over file soup  
3. Your machines, your subscriptions, no telemetry  

Open source (MIT). Download for Mac, or `npx porcelain-daemon@latest serve` on any machine and open a browser. Teach your agent with `npx skills add FabioFiorita/porcelain`.

Happy to answer anything about the Review loop, remote daemons, or why Porcelain deliberately does not run your agents for you.

---

## HN / Reddit

Lead with **problem + specificity**, not branding poetry.

- Show HN: review agent-written features as a story, in a window that is not an editor  
- First paragraph: bottleneck = trust; what the Review is; local CLI; open source  
- Expect: Cursor → viewer not editor; GitHub → whole feature + agent loop + local; T3 → review depth + remote as product  

---

## Voice rules (all public channels)

- Confident, concrete, **zero hype** adjectives  
- Sell *legible* and *trusted*, not “AI-powered” or “blazing”  
- **No em dashes (—) as asides** — they read as AI-generated. Short sentences, commas, colons  
- **No update framing** on the website (“now”, “new”, “no longer”)  
- **No iPad app** language — say browser / mobile devices  
- **No “design identity / reading room”** on the marketing site (metaphor optional once in a personal post, not brand chrome)  
- Channel true **today**: bundled local CLI, not MCP. Never claim Porcelain runs, drives, or authenticates an agent  
- Never leak personal hostnames, employer repos, or private setup  

---

## Links

| What | URL / command |
|------|----------------|
| Site | https://fabiofiorita.github.io/porcelain/ |
| Repo | https://github.com/FabioFiorita/porcelain |
| Releases | https://github.com/FabioFiorita/porcelain/releases |
| Skills | `npx skills add FabioFiorita/porcelain` |
| Daemon | `npx porcelain-daemon@latest serve --tailnet --print-token` |

---

## Related ground truth

- `plans/positioning-and-roadmap.md` — pillars, non-goals, competitive stance, roadmap status  
- `.agents/skills/product/SKILL.md` — full feature truth  
- `.agents/skills/marketing/SKILL.md` — site and screenshot process  
