# Porcelain: product intent

Porcelain is a companion to agentic coding tools. It exists because agents can produce work faster
than a human can understand and confidently review it. That speed can leave people lost and unsure
of the quality they are delivering. Porcelain helps restore focus, orientation, and confidence
through understanding and evidence.

This document records the product owner's intended experience. It is the starting point for
product decisions, not a feature inventory or proof of implementation. Use the
[code map](architecture.md) and owning code to establish current behavior. Older documents and
existing behavior do not silently override this intent. Unresolved choices remain unresolved.

## Audience and purpose

Porcelain serves developers and teams using agents, particularly in large codebases, across
multiple projects and concurrent Worktrees, or on several machines. People keep their preferred
agent harness. Porcelain brings the human's attention, understanding, and review together alongside
it; hosting agents is outside its purpose.

Success means a person can explain what changed, why it matters, where careful review is needed,
what was actually checked, and what remains uncertain. More generated code, documents, or completed
checkboxes do not establish quality by themselves.

## Curate the work

Files helps the human remove distractions by pinning relevant files and hiding irrelevant paths.
These choices curate the project view. Familiar operations—creating files and folders, opening
beside another view, copying paths, revealing, renaming, duplicating, and deleting—support that focus.

The left sidebar is a Worktree picker across projects, within one window. Each checkout is a working
context that the human can return to, much like selecting a conversation. Switching it brings the
corresponding Files, Changes, Git, History, and Canvas context into view. Search, collapsing projects,
and removing projects from the list keep many concurrent efforts manageable. Worktree creation
should support new or existing branches, subject to Git constraints, and project setup scripts.

## Spend attention where it matters

Changes lets the human review working changes or compare a branch with upstream or another local
or remote branch. Its distinctive value is review order. Alphabetical order spends a finite
attention budget without considering the consequences of a mistake.

Agents should organize changes into meaningful layers, placing consequential behavior and contracts
before supporting integration and mechanical changes. The actual diff determines importance; an
export file or a test is not inherently low risk. Useful ordering should emerge from the work
without requiring the human to configure personalization for every review.

Mark as reviewed helps people track coverage and resume interrupted review. Comments support
questions and explanations about a whole file, a selected source range, or a diff. Agents can add
context proactively and answer human feedback in place. Agent activity alone does not mean that
the human reviewed the content.

Git operations should be convenient alongside review: fetch, pull, push, stash and restore, staging,
and writing or generating commit messages. Agents should help propose coherent commit groups so
reviewers elsewhere can follow the work without Porcelain's layers. History should make branch
progress and the evolution of an individual file understandable.

## Canvas is a playground

Canvas is an open place to render HTML and Markdown. People and agents can use it for whatever
explanation or exploration they need: diagrams, tables, plans, product logic, evidence, or other
visual material. Its purpose and timing belong to the developer. After-work explanation is a
central use case, but planning and use during implementation are equally valid choices.

Canvas does not require a particular report structure or a before/during/after sequence. It should
leave agents room to choose an effective visual form. Specialized flows can use Canvas without
restricting the surface to those flows.

## Reveal is a chosen flow

Reveal is the recommended flow for a user who wants to understand completed work. The user and
agent choose to use it; it is not a mandatory lifecycle for every Porcelain task or a synonym for
Canvas. Other flows may be introduced independently.

Reveal combines the product's surfaces to:

- Explain the task and what changed.
- Organize the diff into meaningful review layers.
- Add comments where important files need focused explanation or discussion.
- Present affected files, risks, and observed evidence, including useful screenshots and videos,
  in Canvas.
- Connect the explanation, Changes, and comments so the human can move between the larger picture,
  actual code, and questions about it.

The result should help the human understand and inspect the work. A polished explanation cannot
substitute for examining the diff or demonstrating behavior.

## Agents and the companion skill

MCP provides operations. The shipped companion skill teaches supported agents how to find and
combine them, including how to carry out Reveal when requested. This guidance is for agents working
on users' projects, not just the agent developing Porcelain.

Review layers, Canvas, and comments are the central collaboration capabilities. Other product
operations should be accessible when delegated, including navigation choices, reviewed marks, and
Action configuration. Tool availability does not transfer ownership of human preferences or grant
permission to act. Agents continue implementing and verifying work through their native harness.

## Actions are command shortcuts

Actions let the human click a command such as Dev, Build, or Test instead of typing it in a terminal.
They are convenient development shortcuts, not a place to run agents. Output belongs in unobtrusive
bottom tabs. Agents may write, edit, and configure Actions; the human chooses to run them.

A project may have checkouts on several Environments, each with its own path. The human should be
able to choose the execution target—for example, a server on Linux or an iOS build on the connected
Mac—without opening another terminal to dispatch the command. This human-run Action boundary does
not restrict an agent's authorized execution through its own harness tools.

## Environments feel local

The same product tools and interactions should work against a connected remote Environment as
against a local one. Location stays explicit without requiring separate windows or a different
review workflow. Selecting a remote must not silently replace local authority.

People should be able to name and connect multiple Environments, identify the target when opening
a project, and use LAN, Tailscale, or Cloudflare routes as appropriate. Connection failures must be
visible and understandable. Automatic route fallback is not an agreed requirement; whether and how
to attempt alternate routes remains a product decision. A local desktop's appearance among
shareable Environments should reflect whether sharing is enabled.

Sharing should offer equivalent host operations through the desktop UI and headless daemon CLI:
configure exposure, issue a named device's pairing link, and revoke access. A focused remote skill
makes these operations accessible through agents. Pairing never distributes the administrator
credential, and each daemon remains authoritative for its own resources.

Settings support individual review habits, including appearance, unified or split diffs, source or
rendered documents, Git pull strategy, and commit-message model choice. Medium reasoning is the
intended ordinary commit-message baseline. Updates should make clear whether the desktop app or a
connected daemon will change.

## Building toward this intent

Implementation should be understandable through code, contracts, and meaningful tests. Documents
supply purpose, domain language, navigation, and consequential rationale that source alone cannot
convey. Record architectural choices only when a real decision needs its reasoning preserved; do
not create a prose mirror of the implementation.

Tests should protect meaningful outcomes and invariants. Harmless aesthetic or implementation
alternatives should not fail merely because they differ from an incidental choice in a discussion.
Coverage, mutation testing, complexity, and dependency analysis can inform investigation; scores
cannot replace judgment. Keep current constraints and necessary rationale, not session narratives
or superseded instructions. Repository practice belongs in [AGENTS.md](../AGENTS.md).
