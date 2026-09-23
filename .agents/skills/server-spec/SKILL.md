---
name: server-spec
description: Design and write behavior-first Porcelain server specs for services, controllers, Git, storage, and contracts. Use when adding or changing meaningful server behavior; use server-verify for HTTP evidence.
---

# Server specs

Before writing a spec, state the behavior in domain terms. Read the feature map for an HTTP-facing feature and the public contract for the package under test. List the successful outcome, expected failures, boundaries, and realistic adversarial attempts. Choose the smallest set of cases that would expose a wrong implementation. Do not target coverage, mirror branches, or test trivial delegation.

For a behavior change, write a failing spec before the fix when a focused spec can express the requirement. A spec should assert an observable result, state change, or domain failure; it should not assert private helper calls or implementation order unless ordering is the contract.

- Name files `*.spec.ts`. Use `describe` for the subject and operation, then `it` statements that describe behavior.
- For a service, supply its domain ports and assert its decisions. Never mock the service itself.
- For a controller, test a meaningful sequence, data handoff, cancellation, or event timing with service fakes. Skip controllers that only forward one call.
- For Git, use a disposable real repository for command behavior and malformed input for pure parsers. Exercise rejected states and limits. Never depend on the developer's checkout.
- For storage, use a disposable migrated SQLite database and assert persistence and atomicity through the repository's public port.
- For Zod contracts, test non-obvious input transformations and rejected wire values. Let TypeScript check typed internal values.

Run the focused spec with the package's established test command. If no runner or command exists yet, choose and install it as a separate tooling decision before adding specs; do not invent a one-off script. After a server behavior change, also run the relevant `server-verify` feature when mapped and report its HTTP evidence separately from the spec result. Record any untested behavior honestly.
