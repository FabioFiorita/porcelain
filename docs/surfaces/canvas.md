# Canvas

Read this before adding any surface whose job is "let the agent explain something." The answer is
almost always a Canvas template, not a new surface (ADR 0004).

## What it is

One free HTML-first surface an agent puts anything on: a diagram, a comparison table, a flow
explanation, a written review, a screenshot, a chart. HTML because humans read rendered output
faster than prose about code, and because an agent that can emit HTML can emit every shape without
Porcelain shipping a widget for each one.

## Rules

**Canvas is a primitive; conventions live in skills.** The Review — Intent · Process · Execution ·
Evidence — is a template shipped in the companion skill, not a structure in the product. So is
explaining an existing flow. When a proposed feature is really a *shape of document*, it belongs in
a skill where it can change without a release and where a user who works differently can replace it.

**Do not grow a second explanation surface.** Every "read-only mode for understanding X" is a Canvas
template. Two navigation models for agent-authored explanation is the specific mistake that
retired explore-a-flow.

**Canvas carries quantitative evidence.** Coverage delta, mutation score, cognitive complexity, and
new dead code belong on the change beside its story — as **reading triage**, not as decoration and
not as a gate. When several agent changes land at once and reading time is finite, a tight diff with
a high mutation score and clean structure can be skimmed; thin coverage over a complex service
cannot. Metrics never decide whether the work is correct — they cannot detect a well-built wrong
feature — they decide where the reading goes.

**Never let a number read as a verdict.** A green score means "this is cheaper to trust", never
"this is right". Copy on this surface must not imply the second.

## Security

The sandbox is load-bearing, not incidental. An unpromoted Canvas renders in a
`sandbox="allow-scripts"` iframe with **no** `allow-same-origin`, on an opaque origin, under a
`connect-src 'none'` CSP. That combination is what makes it safe to render HTML written by an agent.

Promotion into Git changes the threat model — a promoted Canvas is a tracked file that `git pull`
can deliver from someone else's repository, which is third-party HTML with runnable script. ADR 0002
owns that decision; do not weaken the unpromoted policy to make promotion simpler.
