# Plans

**What isn't yet.** `docs/` is what is; this tree is intent — plans, backlogs, anything with a
TODO. Day-to-day task tracking stays on the Porcelain board; a file lands here only when a plan
is worth writing down before it can be executed.

Rules that keep it honest:

- One directory per effort: `plans/<slug>/` (or a single `plans/<slug>.md` when it fits in one file).
- **Delete a plan when it ships** — git is the archive. Never leave a shipped plan to rot into
  false documentation.
- Before deleting, distill anything durable into `docs/` or the owning `AGENTS.md`. Never move a
  plan wholesale into docs — plans are written in the wrong tense for reference.

Active efforts:

- [`agent-dev-foundations.md`](agent-dev-foundations.md) — make the agent development loop
  reproducible: paired environment in one command, a playground fleet, seeded daemon state,
  remote-environment proof, and the surface walk that catches "worked on the path I tested".

Landed work is represented by the current code, `docs/`, `AGENTS.md`, and the permanent
mechanical gates; shipped plans are removed from this tree.
