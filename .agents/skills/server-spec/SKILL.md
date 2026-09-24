---
name: server-spec
description: Decide whether a Porcelain server unit needs a behaviour spec, derive its cases from the unit's promise, and write it with in-memory fakes. Use when adding or changing a service, rule, parser or sequencing use case; use server-verify for HTTP evidence.
---

# Server specs

A spec states what a unit promises. Write it from the promise, not from the code: a wrong implementation must fail it, and a reader must learn the behaviour from it without opening the implementation.

There are two levels only: these behaviour specs, and feature verification through the real server (`server-verify`).

## 1. Decide whether the unit gets a spec

Spec a unit that decides:

- services and rules;
- parsers of external output (Git porcelain, model output);
- use cases whose sequence is itself the behaviour: ordering, event timing, lane choice.

Ask: would a plausible wrong implementation pass without this spec? If not, write none. Coverage is never a reason.

Never spec libraries we chose (Zod parsing, Fastify routing, Drizzle query building), a service or use case that forwards one call, facts TypeScript already enforces, private helpers, or bootstrap wiring.

## 2. Derive the cases before reading the implementation

Read only the promise: the unit's name, its ports, its models and errors, and the feature map entry in `.agents/skills/server-verify/feature-map/` when the unit serves an HTTP feature. List:

1. the success path;
2. every failure the unit can produce, by error class;
3. its boundaries: empty, one, the limit, one past the limit;
4. the adversarial attempts a QA would try: unknown ids, duplicates, traversal paths, malformed or hostile input, repeated or concurrent calls.

Only then open the implementation, to check that nothing in the promise was missed. If the code does something the list does not predict, decide whether the promise or the code is wrong before writing a case for it.

For a behaviour change, write the failing case first when a focused spec can express it.

## 3. Shape

- One `describe` per subject, named after the unit.
- One `it` per observable behaviour, named as a sentence a reader can check: `keeps the owner's name when discovery runs again`.

## 4. Doubles

- Hand-write an in-memory fake that implements the port interface and is typed by it. Keep it honest: it stores, returns and fails the way the real adapter would.

## 5. Real things where the unit is about real things

- Git commands run against a disposable real repository created in a temp directory and removed afterwards. Never read the developer's checkout.
- Parsers get real captured output, including the malformed and truncated variants Git or the model actually produce. Git output is captured by `node packages/git/spec/fixtures/capture.ts`, which rebuilds every file from disposable repositories; a variant Git never produces is derived there by an explicit edit and its file name ends in `-hand-edited`.
- A storage repository gets at most one persistence-and-cascade spec, through its port, on a disposable migrated SQLite database.

## 6. Placement

- `<name>.spec.ts` sits beside the file it describes.
- Fakes live in `packages/<domain>/spec/fakes/`. Captured output and sample builders, the functions and constants that build a model value for a spec, live in `packages/<domain>/spec/fixtures/`; captured output is read through that folder's `fixture.ts` helper. Both sit outside `src`, so production code cannot import them.

The `spec-*` rules in `architecture/oxlint-plugin.mjs` and the `fake` and `fixture` roles in `architecture/policy.ts` enforce the forbidden APIs, names and imports; read them rather than a list here.

## 7. Checklist

1. Every case traces to a line of the promise list from step 2.
2. Each case would fail against a plausible wrong implementation; delete the ones that would not.
3. `pnpm test` passes.
4. `pnpm lint:server` passes.
5. `pnpm arch:check` and `pnpm typecheck:server` pass.
6. `pnpm format:server:check` passes.
7. After a server behaviour change, run the mapped `server-verify` feature and report its HTTP evidence separately from the spec result. State plainly any promise left without a spec and why.
