# Agents compute evidence; Porcelain renders it

The quantitative evidence on a change — coverage delta, mutation score, cognitive complexity, new
dead code — is produced by the **agent**, written into the Canvas over MCP, and only displayed
by Porcelain. Porcelain never runs a test suite, a coverage pass, or a static analyser.

The tempting alternative is for Porcelain to compute these itself: it already knows the repository
and the changed files, and a button would be convenient. It is the wrong shape for three reasons.
It is the cockpit breadth `product.md` exists to refuse — a review layer that runs builds is on its
way to being an agent host. It would require Porcelain to learn how *every* repository produces
coverage, which is unbounded work that fails on the first project with an unusual toolchain. And it
would silently restrict Porcelain to ecosystems it has been taught, when the product has no reason
to care what language it is reading.

Agents already run these commands inside their own loop. Handing the numbers to Porcelain costs
them one more tool call and costs Porcelain nothing.

This is the same division the product applies everywhere: **Porcelain ships the mechanism, the user
and their agent own the policy.** It is why profiles are agent-written rather than inferred (ADR
0006), why Actions are curated rather than generated, and why the Review is a skill template rather
than a product structure (ADR 0004).

**Numbers are triage, never verdict.** They answer *where should the reading go* — a tight diff with
a high mutation score can be skimmed, thin coverage over a complex service cannot. They never answer
*is this correct*, because no metric detects a well-built wrong feature, and agents are unusually
good at producing exactly that. Copy on these surfaces must not imply otherwise, and no gate is ever
built on a number Porcelain did not compute and cannot verify.
