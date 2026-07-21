# Launch narrative: Porcelain

**Audience:** X threads, Product Hunt, HN, launch emails, podcast intros.  
**Source of truth for product claims:** shipped app + `product` skill + this file.  
**Identity statement:** *Porcelain is where agent work becomes trusted work.*

Do not invent features. Do not use update framing (“we now…”) on the landing page; launch posts may narrate the journey once.

---

## One-liner (everywhere)

**Where agent work becomes trusted work.**

### Variants

| Context | Line |
|---------|------|
| Product Hunt tagline | Run coding agents. Review what they built as a story, not a file list. |
| X bio / short | Hub for agentic coding: run agents, review as a story, trust what ships. |
| HN title style | Porcelain: lightweight hub to run coding agents and review their work as a feature story |
| Subtitle | Mac, Linux, or any browser. Your CLIs. Local only. Open source. |

---

## 15-second pitch

Everyone is racing to spawn more coding agents. Porcelain stands on the other side of the pile: one lightweight window where you **run** Claude Code, Codex, OpenCode, and Grok, and **review** what they built the way a senior engineer reads a feature: as a story, not an alphabetical dump of files. Trust is the product.

---

## 60-second pitch

The bottleneck in software moved from writing code to understanding agent-written code. Editors are built for authoring. Git GUIs show flat file lists. New “agent cockpits” grow the unreviewed pile.

Porcelain is not an IDE. It is the **reading room for agentic coding**:

1. **The Review.** Your agent publishes Intent, Execution, and Evidence: thesis, flow-ordered walkthrough (including the other half of the client/server seam), and proof it verified its work.
2. **Flow-ordered diffs.** Even without a Review, changes read from entry point to data.
3. **A closed human↔agent loop.** Line comments, board, claims, local CLI, companion skills. No MCP port, no telemetry.
4. **Remote as a product.** One daemon; Mac app, remote environment, or any browser (including on mobile). State lives on the host you own.

Open source. Free. Your agent subscriptions, your machines.

---

## Philosophy (for threads & PH “Maker comment”)

### Origin

Porcelain started as a companion next to Codex, Claude in a terminal, or whatever agent lived outside the window: a place to **see files and diffs** and understand what the agent did. Then came git actions, history, search, a board, a terminal, agents **inside** the app, environments so a Mac and a Linux box work as one system, and finally **the Review**: the whole feature as a document the agent authors and the human signs off.

The product got bigger. The soul did not: **humans must still understand and trust agent work.**

### What we believe

- **Trust over velocity.** Shipping more unreviewed diffs is not progress.
- **Story over soup.** A feature is a path through the stack, not a sort of `path/to/file`.
- **Connected homes, not silos.** Deep work has one home (Changes, Feature, Agent, Terminal); other surfaces preview and hand off.
- **Viewer, not editor.** Lightweight always wins. The IDE stays the IDE.
- **Legible, not glassy.** Design identity is the reading room: calm, opaque, serious.
- **Local by default.** Channels are files + a CLI on your machine. No Porcelain cloud for your code.
- **Narrow agents, deep review.** Four providers done well beats a nine-provider treadmill.

### Three pillars (priority order)

1. **Review depth** (moat): Review, flow, comments, evidence, monorepo hide/pin, explore.
2. **Remote as product** (second moat): daemon, three clients, daemon-side state.
3. **Running agents** (table stakes): threads, worktrees, permissions. Deliberately not the brand.

### Non-goals (say this when asked “why not X?”)

- Provider-count race  
- Cross-provider hand-off theater  
- Scheduled automations / built-in browser as core  
- Becoming an editor  
- Windows-native app first (browser covers clients)  
- Competing with YouTube-driven star counts. Compete on **retention of reviewers**

### Competitive frame (honest)

| | Agent cockpits | Porcelain |
|--|----------------|-----------|
| Center | Spawn & steer | Understand & trust |
| Review | Diff / PR-shaped | Story + whole feature + evidence |
| Remote | Plumbing / later | First-class product |
| Integration | Chat / MCP | Local CLI + skills, two-way |

---

## Who it is for

**Primary:** Engineers already serious about Claude Code / Codex / OpenCode who feel the new bottleneck is **reading and trusting**, often in monorepos, often with a second machine.

**Secondary:** People who want a home server or cloud box as compute and a laptop or phone browser as the seat.

**Not yet:** Non-engineers, Enterprise PR-as-center-of-gravity teams, “AI that writes so I don’t have to look.”

---

## Benefits (order for marketing)

1. Trust, not just velocity  
2. The Review (document, not pile)  
3. Flow-ordered diffs  
4. Closed human↔agent loop (comments, board, CLI)  
5. One workspace (run + review)  
6. Anywhere is the same place (remote/daemon)  
7. Huge repos stay usable  
8. Open, local, free  

---

## X / Twitter: thread skeleton

1. **Hook:** Agents write code faster than anyone can trust it. Porcelain is where that work becomes trusted work.  
2. **Problem:** Editors are heavy for reading. Git UIs are alphabetical. Cockpits spawn more agents → bigger unreviewed pile.  
3. **Hero:** The Review (Intent · Execution · Evidence). Screenshot.  
4. **Flow:** Diffs ordered like the runtime path. Screenshot.  
5. **Loop:** Comment on a line → agent resolves. Local CLI, no port.  
6. **Agents:** Same window. Your CLIs. Worktrees + Review inbox.  
7. **Remote:** `npx porcelain-daemon@latest serve` → Mac app or any browser (including mobile) to a machine you own.  
8. **Close:** Open source · MIT · macOS + Linux · no telemetry. Link + install skills one-liner.  
9. **CTA:** Star, download, or tell us what you review first.

Tone: calm, concrete, zero “blazing/revolutionary.” Show screenshots of the **current** opaque UI.

### Single posts (copy-paste)

**Launch day:**  
Porcelain is out: where agent work becomes trusted work. Run Claude Code / Codex / OpenCode / Grok in one window. Review the whole feature as a story (Intent → Execution → Evidence). Local CLI, remote daemon, open source.  
[link]

**Philosophy:**  
I built Porcelain because I stopped believing “more agents” was the hard part. The hard part is still understanding what shipped. So: a reading room for agentic coding, not another cockpit dashboard.

**Remote:**  
My laptop is a thin client. The agents and terminals live on a box I own. Porcelain is one daemon, three clients (app, remote env, any browser). Same review state after reconnect.

---

## Product Hunt: assets checklist

| Asset | Content |
|-------|---------|
| Name | Porcelain |
| Tagline | Where agent work becomes trusted work |
| Description (first 260 chars) | Lightweight hub for agentic coding: run your agents and review what they built as a feature story (Intent, Execution, Evidence), not a file list. Mac, Linux, or any browser. |
| Gallery | 1) Review hero 2) Flow Changes 3) Agent thread 4) Comment loop 5) Remote/install command 6) Board |
| First comment | Origin + pillars (short) + link to skills install + honesty: not an IDE |
| Topics | Developer Tools, AI, Productivity, Open Source, Git |

### PH first comment (template)

Hey PH. I’m Fabio.

Porcelain started as a place to **read** what coding agents did. It grew into the place I actually work: agents run inside, remotes connect my Mac to a Linux box, and the agent publishes a **Review** so I can sign off on a whole feature, not an alphabetical diff.

Three beliefs:

1. Trust over velocity  
2. Story over file soup  
3. Your machines, your subscriptions, no telemetry  

It’s open source (MIT). Download for Mac/Linux, or `npx porcelain-daemon@latest serve` and open a browser. Teach your agent with `npx skills add FabioFiorita/porcelain`.

Happy to answer anything about the Review loop, remote daemons, or why we stayed out of the provider-count race.

---

## HN / Reddit: framing

Lead with **problem + specificity**, not branding poetry.

- “Show HN: Porcelain: review agent-written features as a story (and run the agents in the same window)”  
- First paragraph: bottleneck = trust; what the Review is; local CLI; open source.  
- Expect: “why not Cursor?” → viewer not editor; “why not GitHub?” → whole feature + agent loop + local; “why not T3?” → review depth + remote product.

---

## Voice rules (all channels)

- Confident, concrete, zero hype adjectives  
- Sell *legible* and *trusted*, not “AI-powered”  
- Claims must be true of the shipped app **today** (providers: Claude Code, Codex, OpenCode, Grok; channel: CLI not MCP)  
- Never leak personal hostnames, employer repos, or private setup  
- Timeless product language on the website; journey language OK once in launch posts  

---

## Links

| What | URL |
|------|-----|
| Site | https://fabiofiorita.github.io/porcelain/ |
| Repo | https://github.com/FabioFiorita/porcelain |
| Releases | https://github.com/FabioFiorita/porcelain/releases |
| Skills | `npx skills add FabioFiorita/porcelain` |
| Daemon | `npx porcelain-daemon@latest serve --tailnet --print-token` |

---

## Related docs

- `plans/positioning-and-roadmap.md`: competitive landscape + pillars  
- `.agents/skills/product/SKILL.md`: feature truth  
- `.agents/skills/marketing/SKILL.md`: site/screenshot process  
