# Published summary isolation and retention

A review summary belongs to the latest atomic publication for a worktree. It is stored in SQLite
beside its behavior layers so readers cannot observe a new explanation with an old summary.
Replacing a publication revokes its previous summary capability. This replaces independent artifact
uploads and per-commit review snapshots; commit history remains Git's responsibility.

The summary may execute agent-authored HTML and load internet resources. It therefore runs in an
opaque-origin sandbox, with the same sandbox restriction on the response itself. A short-lived,
unguessable capability lets that frame read only its summary without granting it the browser's
API authority. Possession of the capability permits reading that summary until expiry or replacement;
it is not a permanent sharing URL. The parent accepts layer navigation only from its own frame and
only for a layer in the current publication.

Saved reviews remain readable when a registered checkout is unavailable. Diagnostics are explicitly
unavailable in that state; stored explanation does not prove current code or coverage. Inventory
refresh must not erase review data merely because a checkout temporarily disappears.
[Explicit project removal](project-removal.md) is the user-requested exception to retention.

The owning contracts, routes and regression tests define payload bounds and capability validation.
