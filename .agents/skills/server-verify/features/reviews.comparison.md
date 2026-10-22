# Revision comparison

[The server integration test](../../../../apps/server/spec/integration/reviews-comparison.integration.ts) proves retained review comparisons across a rebase, mark carry/reset, conversation and proof changes, interdiffs, invalid revisions and retention after worktree removal. Run that test by name; it owns the disposable fixture and cleanup.
