-- Comment revisions are handed out from one counter that only grows. The next
-- revision used to be the highest revision still stored plus one, so deleting
-- the threads that held it, by collecting a worktree or removing a project,
-- handed the same numbers out again, and a comments-seen mark or a client that
-- had seen the old numbers took the new threads for seen.
--
-- The counter starts above every revision a thread, an agent reply or a
-- comments-seen mark still names. Numbers already reused before this migration
-- cannot be told apart and stay as they are.
CREATE TABLE `comment_revision` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	CONSTRAINT "comment_revision_singleton" CHECK("comment_revision"."singleton" = 1)
);
--> statement-breakpoint
INSERT INTO `comment_revision` (`singleton`, `revision`)
SELECT 1, MAX(
	COALESCE((SELECT MAX(`revision`) FROM `comment_threads`), 0),
	COALESCE((SELECT MAX(`last_agent_revision`) FROM `comment_threads`), 0),
	COALESCE((SELECT MAX(`seen_through`) FROM `comment_reads`), 0)
);
