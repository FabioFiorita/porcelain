-- Project names come from `origin`, and each worktree can show a status dot.
--
-- Three changes, one transaction:
--
--  * `named_by_owner` records who chose a project's name. Every existing name
--    was derived from a folder, so they all start as not owner-chosen and the
--    next registration replaces them with the repository's own name.
--  * `comment_threads` gains a monotonic `revision`, seeded from the sequence
--    it already had, and `last_agent_revision`, which is that revision when
--    the last message is the agent's. That is what the yellow dot asks about.
--  * `comment_reads` records how far the owner has actually seen. It is only
--    ever advanced by an explicit act, never by a background list.
ALTER TABLE `inventory_projects` ADD `named_by_owner` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `comment_threads` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `comment_threads` ADD `last_agent_revision` integer;
--> statement-breakpoint
UPDATE `comment_threads` SET `revision` = `sequence`;
--> statement-breakpoint
UPDATE `comment_threads`
SET `last_agent_revision` = `revision`
WHERE json_extract(
  `data`,
  '$.messages[' || (json_array_length(`data`, '$.messages') - 1) || '].author'
) = 'agent';
--> statement-breakpoint
CREATE TABLE `comment_reads` (
  `worktree_id` text PRIMARY KEY NOT NULL,
  `seen_through` integer NOT NULL
);
