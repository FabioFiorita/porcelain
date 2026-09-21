# Ordered review-layer metadata

A worktree has one live layer set with a monotonically increasing revision. Layer IDs are caller-generated stable identities; array positions define layer and file order. Replacing the set is atomic and requires the expected revision, so concurrent writers must reload and reconcile after a conflict.

Layer metadata describes intent. It does not read Git or files, prove that a path still exists, or claim to cover every current change. Changes therefore keeps unassigned files visible. Paths and staged or unstaged scope use the same canonical grammar as other file metadata.

Layer sets use stable worktree IDs without foreign keys to transient inventory rows. Temporary unavailability and disappearance from active inventory retain an existing set; a new set requires a currently registered worktree. Recreating a checkout with a new identity does not inherit the old set.

A successful commit clears the live references carried by that commit so the worktree stops requesting review for committed work. Per-commit review-layer copies and their HTTP surface have been removed. The legacy table is retained only to avoid destroying stored data during an upgrade; no current behavior reads it. Removing that table requires a deliberate migration decision.
