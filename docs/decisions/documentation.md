# Executable contracts and thin documentation

Status: accepted. Recorded 2026-09-04 from the repository owner's documentation direction.

## Decision

Use code, schemas, configuration, scripts, and tests to establish implementation behavior.
Documentation provides domain language, navigation, operational instructions, and consequential
choices whose reasoning cannot be recovered from the code alone.

When an implementation is hard to discover or understand, improve its names, boundaries, interfaces,
or tests. Do not create a parallel prose specification as a substitute. Investigate a disagreement
between prose and code at the owning implementation; neither prose nor existing code establishes
that the behavior is correct merely by existing.

## Alternatives and consequences

A comprehensive prose mirror makes initial reading convenient, but creates a second description
that must be synchronized without an executable guarantee. We reject it for implementation detail.
A code-only repository avoids that duplication but loses domain meaning, operating context, and
reasons for consequential choices. We retain those in focused documents with links to their owners.

Decision records keep real alternatives and the tradeoffs behind an accepted choice. They are not
session diaries or speculative accounts of prior discussions. Mark a decision superseded when it
changes and link its replacement; do not erase the reason an important constraint existed.

This keeps less context in the default reading path, at the cost of requiring source inspection for
implementation questions. Small navigation maps and adjacent behavioral tests make that inspection
cheaper. Do not add prose-matching tests just to freeze documentation wording.
