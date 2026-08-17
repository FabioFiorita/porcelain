# Canvas is the primitive; the Review is a template

The **Canvas** is the product primitive: one free surface an agent can put anything on — a diagram,
a comparison table, a flow explanation, a written review, a screenshot, a chart. It is HTML-first
because humans read rendered HTML faster than they read prose about code, and because an agent that
can emit HTML can emit every other shape without Porcelain shipping a widget for each one.

The **Review** — Intent · Process · Execution · Evidence — is a **template on the Canvas**, not a
structure in the product. It ships in the companion skill and is offered when instantiating a
Canvas. It is worth keeping: it is a good shape for writing up finished work. It is not worth
hard-coding: it came from the era when Porcelain hosted the agent and could assume the agent
narrated its plan here, and today that narration lives in the harness.

The rule this settles, and the reason to state it once: **the product owns primitives; skills own
conventions.** A structure that only makes sense for one way of working belongs in a skill, where it
can change without a release and where a user who works differently can replace it. A surface that
every convention needs belongs in the product.

**Explore a flow is retired as a feature** and becomes a Canvas template on the same reasoning. The
value was never a dedicated read-only mode; it was an agent explaining how existing code hangs
together. An agent with a Canvas already does that, better, and without a second navigation model to
maintain.

**Canvas also carries quantitative evidence.** Coverage delta, mutation score, cognitive complexity,
and new dead code belong on the change, next to its story. Not as decoration and not as a gate —
those numbers cannot tell you whether the agent built the right thing — but as **reading triage**.
When several agent changes land at once and reading time is finite, a tight diff with a high
mutation score and clean structure can be skimmed, and thin coverage over a complex service cannot.
Metrics do not replace reading; they direct it.

The security posture for Canvas HTML is unchanged and load-bearing: unpromoted Canvases render in a
`sandbox="allow-scripts"` iframe with no `allow-same-origin`, on an opaque origin under a
`connect-src 'none'` CSP. Promotion into Git changes the threat model and is handled explicitly in
ADR 0002.
