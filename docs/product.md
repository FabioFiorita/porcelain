# Porcelain: product intent

Porcelain is a companion for developers working with coding agents. It helps them understand and
review their work, whether they’re using a computer, tablet, or phone.

Porcelain works alongside tools such as Codex. Developers use their preferred tools to run coding
agents and Porcelain to understand and review the resulting work. Porcelain does not host or run
coding agents.

Porcelain succeeds when developers understand what changed, why it matters, where their attention
is needed, and what was checked or remains uncertain. Its distinguishing value is the clarity it
brings to reviewing agent work.

## Files

Files gives developers a prominent place to explore their project, read code, and understand how
it is organized. It follows familiar editor conventions, with everyday operations such as
creating, renaming, duplicating, deleting, copying paths, and revealing files in the system file
manager.

Pinning relevant files and hiding distracting paths let developers tailor the view to their work
without changing the underlying project.

## Projects and Worktrees

The left sidebar is a Worktree picker across projects, within one window. Each checkout is a working
context that developers can return to, much like selecting a conversation. Switching it brings the
corresponding Files, Changes, Git, History, and Canvas context into view. Search, collapsing projects,
and removing projects from the list keep many concurrent efforts manageable. Worktree creation
should support new or existing branches, subject to Git constraints, and project setup scripts.

## Changes

Changes lets developers review working changes or compare a branch with upstream or another local
or remote branch. Its distinctive value is review order. Alphabetical order spends a finite
attention budget without considering the consequences of a mistake.

Review layers organize changes by the attention they need, placing consequential changes before
supporting details. Useful ordering emerges from the work without requiring developers to
configure personalization for every review.

Developers can mark individual files as reviewed to track their progress, see what remains, and
resume where they left off. These marks provide a clear sense of progress toward completing the
review.

## Comments

Developers can leave comments on a whole file, a selected block of code, a diff, or a selected
part of a diff—including unchanged files and uncommitted changes. The agent receives both the
comment and its location, so it understands exactly what the developer is referring to.

Agents can use those same locations to explain their work, letting developers read an explanation
alongside the code or changes it concerns.

## Git

Git gives developers familiar operations through clear controls: checking status, cloning
repositories, fetching, pulling, pushing, staging, stashing, and committing. Contextual
recommendations suggest useful next steps, such as pulling available remote changes or pushing
local commits.

A commit composer supports types such as `feat`, `fix`, and `test`, an optional scope, and a
message. Developers can write messages themselves, generate one with AI, or ask AI to organize
changes into coherent commits with individual messages, producing a clear history.

## History

History lets developers browse commits and inspect the history of individual files. It provides
familiar access to past changes as part of everyday development.

## Canvas

Canvas is a space where agents can make ideas and work tangible—through explanations, visuals,
and interactive content that developers can explore and refine.

## Agents and the companion skill

Agents access Porcelain's capabilities through MCP. The companion skill explains how to use
and combine those tools.

Review layers, Canvas, and comments are the central collaboration capabilities. Other product
operations should be accessible when delegated, including navigation choices, reviewed marks, and
Action configuration.

## Actions

Actions let developers click a command such as Dev, Build, or Test instead of typing it in a terminal.
They are convenient development shortcuts, not a place to run agents. Output belongs in unobtrusive
bottom tabs. Agents may write, edit, and configure Actions; developers choose to run them.

Actions can run on the local machine or a connected Environment, independently of the current
view. Developers can access their local terminal while working with a remote project—for example,
running Expo Metro on Linux and starting an iOS simulator on a Mac.

## Environments

Developers have the same tools and interactions across local and remote Environments. Moving
between them feels seamless, without requiring developers to manage connection details as part
of everyday work.

Developers can easily connect their machines and devices to work across Environments.

Developers can connect devices and revoke their access through Porcelain's interface or their
preferred agent.

## Settings

Settings let developers adjust Porcelain to their preferences.

## Updates

Updates should make clear whether the desktop app or a connected daemon will change.
