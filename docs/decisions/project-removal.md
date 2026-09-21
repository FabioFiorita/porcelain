# Explicit project removal

Removing a project permanently forgets its inventory and private Porcelain data in that environment. It never removes a checkout, changes Git state, or inspects repository files. An unavailable project can be removed, and registering its checkout later creates fresh Porcelain identity and state. Removal is not an archive or undo operation.

The deletion is one SQLite transaction covering the project's review layers, comments, artifacts, preferences, Git preparations and receipts, inventory, and retained ownership records. Other projects and the environment identity survive. Artifact quota is released, but SQLite file shrinkage and secure physical erasure are not promised.

Removal is a writer on the project's operation lane, so an action already running finishes first. It is still allowed after an action ended without a confirmed outcome: removal deletes that project's durable refusal latch and the coordinator forgets its in-memory block. The repository remains unchanged and can be registered again. A submit accepted just before removal cannot launch after its preparation has been deleted.
