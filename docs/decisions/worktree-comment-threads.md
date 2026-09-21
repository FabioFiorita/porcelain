# Worktree comment threads

Comments belong to the worktree's identity rather than its checkout path. Moving or
temporarily disconnecting a checkout must not transfer its discussion to another
repository or discard it. Absent-worktree cleanup owns eventual removal.

Posting must remain available while Git actions run. Message insertion, capacity checks,
retry detection and revision allocation therefore share a SQLite transaction instead of
waiting in a Git operation lane. Concurrent replies are ordered by their committed
sequence; a caller's ordering of concurrent requests is not a delivery guarantee.

Clients retain a thread/message ID for a submission until its outcome is confirmed.
Repeating the same ID and payload returns the saved discussion without another message
or revision; conflicting reuse is rejected. This makes recovery from a lost response
safe without treating two intentionally identical messages as duplicates. Older callers
may omit IDs, but cannot identify a later request as a retry unless they retain them.

Messages have separate rows so a reply does not rewrite earlier messages. Migration
preserves historical IDs, text, order, optional timestamps and seen revisions. Resolving
and reopening remain possible at capacity. Unread state follows revisions rather than
wall-clock time, so acknowledging an older snapshot cannot hide a later agent reply.

Authorship comes from the authenticated server principal. Anchors remain caller-supplied
code locations; relocation and outdated-code presentation belong to the subsequent
review work. Nothing here promises that a stored line number still identifies the same
code after an edit.
