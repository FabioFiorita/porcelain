# Architecture inventory

This directory maps current Porcelain into the accepted target architecture before any execution
specification moves code. It is evidence for migration scope, not a description of the target alone.

An item is inventoried only when it has:

- an exact current path or public name;
- one target product domain or named supporting region;
- its current callers and participating runtimes;
- persisted, wire, security, performance, or lifecycle constraints;
- cross-domain collaborators and workflow owner where relevant;
- a clean-cutover classification for aliases, migrations, defaults, and fallback behavior;
- tests that currently protect it and gaps that a migration must close;
- a disposition: retain, reshape, move, replace, or delete.

## Coverage

The completed inventory covers:

1. every public daemon procedure and authenticated WebSocket message;
2. every contract catalog entry and local client schema mirror;
3. every CLI noun and verb;
4. every repo-local and daemon-home persisted file;
5. every daemon router, operation-like module, store, adapter, and composition path;
6. every Web hook, store, domain component region, and transport boundary;
7. every mobile feature, daemon descriptor, store, and transport boundary;
8. every client-runtime export and duplicated cross-client semantic rule;
9. every current migration, deprecated shape, compatibility alias, and fallback branch;
10. every Ship, Audit, Companion, `AGENTS.md`, hook, lint, and contributor-procedure responsibility;
11. every important cross-domain workflow;
12. every oversized authored production file and target-boundary import violation.

Unowned or ambiguous items block specification delegation. They return to architecture discussion or
receive an explicit coordinating operation in the workflow map.

## Clean-cutover classification

Every branch described by words such as legacy, fallback, compatibility, migration, default, retry,
or recovery is classified by reason rather than name:

| Class | Target disposition |
|---|---|
| Pre-launch compatibility | Delete with its callers and compatibility-only tests |
| Permanent resilience | Retain under an explicit domain owner and prove |
| Intentional product default | Retain, name as default behavior, and test from clean state |
| Temporary migration scaffolding | Exact removal step in the same planned batch |
| Unsupported or accidental behavior | Delete after proving no accepted product dependency |

No inventory entry authorizes deleting material user data. Storage reset scope is specified and
reviewed separately.

## Outputs

The inventory is distilled into tracked maps for:

- canonical domains and vocabulary;
- procedures, messages, contracts, and clients;
- persisted data and clean-launch format ownership;
- cross-domain workflows and capability dependencies;
- supporting regions and package leaks;
- compatibility deletion and resilience retention;
- agent foundations and earned invariants;
- current tests and target test ownership;
- migration dependency order.

Scratch reports from inventory agents live under `scripts/agent-scratch/` and are not durable plan
artifacts. Their claims must be checked against current code before entering a tracked map.
