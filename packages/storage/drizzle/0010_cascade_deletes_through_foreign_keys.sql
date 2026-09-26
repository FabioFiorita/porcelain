-- Deleting a project or collecting an absent worktree becomes one DELETE: every
-- row that belongs to a project or a worktree names its parent with a foreign
-- key that cascades.
--
--  * inventory_projects owns worktree_presence, project_file_preferences and
--    git_action_receipts. Receipts gain a `project_id` column copied from the
--    stored receipt, because a foreign key needs a column.
--  * worktree_presence owns everything keyed by worktree: reviews, reviewed
--    files and layers, comment threads, comment messages and comment reads. It
--    is the only table that knows which project a worktree belongs to, so a
--    project removal reaches review data through it.
--
-- SQLite cannot add a foreign key to an existing table, so each child is
-- rebuilt. Migrations run with foreign key enforcement off and a
-- foreign_key_check before commit, so dropping a parent here cascades nothing.
-- Rows whose parent no longer exists are deleted: nothing could reach them and
-- nothing would ever remove them.
--
-- inventory_projects is rebuilt too, so its `named_by_owner` column matches the
-- schema: no default, and the same 0/1 check as the other flags.
CREATE TABLE `__new_inventory_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`named_by_owner` integer NOT NULL,
	`common_directory` text NOT NULL,
	`repository_identity` text NOT NULL,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "project_id_present" CHECK("__new_inventory_projects"."id" IS NOT NULL),
	CONSTRAINT "project_available" CHECK("__new_inventory_projects"."available" IN (0, 1)),
	CONSTRAINT "project_named_by_owner" CHECK("__new_inventory_projects"."named_by_owner" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_inventory_projects` ("id", "name", "named_by_owner", "common_directory", "repository_identity", "available", "position")
SELECT "id", "name", "named_by_owner", "common_directory", "repository_identity", "available", "position" FROM `inventory_projects`;
--> statement-breakpoint
DROP TABLE `inventory_projects`;
--> statement-breakpoint
ALTER TABLE `__new_inventory_projects` RENAME TO `inventory_projects`;
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_projects_repository_identity_unique` ON `inventory_projects` (`repository_identity`);
--> statement-breakpoint
DELETE FROM `worktree_presence` WHERE `project_id` NOT IN (SELECT `id` FROM `inventory_projects`);
--> statement-breakpoint
CREATE TABLE `__new_project_file_preferences` (
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`pinned` integer NOT NULL,
	`hidden` integer NOT NULL,
	PRIMARY KEY(`project_id`, `path`),
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_preference_pinned" CHECK("__new_project_file_preferences"."pinned" IN (0, 1)),
	CONSTRAINT "project_preference_hidden" CHECK("__new_project_file_preferences"."hidden" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_project_file_preferences` ("project_id", "path", "pinned", "hidden")
SELECT "project_id", "path", "pinned", "hidden" FROM `project_file_preferences`
WHERE `project_id` IN (SELECT `id` FROM `inventory_projects`);
--> statement-breakpoint
DROP TABLE `project_file_preferences`;
--> statement-breakpoint
ALTER TABLE `__new_project_file_preferences` RENAME TO `project_file_preferences`;
--> statement-breakpoint
CREATE TABLE `__new_git_action_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_git_action_receipts` ("request_id", "project_id", "value")
SELECT "request_id", json_extract("value", '$.projectId'), "value" FROM `git_action_receipts`
WHERE json_extract("value", '$.projectId') IN (SELECT `id` FROM `inventory_projects`);
--> statement-breakpoint
DROP TABLE `git_action_receipts`;
--> statement-breakpoint
ALTER TABLE `__new_git_action_receipts` RENAME TO `git_action_receipts`;
--> statement-breakpoint
CREATE INDEX `git_action_receipts_project` ON `git_action_receipts` (`project_id`);
--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`published_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`summary_html` text NOT NULL,
	`summary_token` text NOT NULL,
	`summary_secret` text NOT NULL,
	`diagram` text,
	`layers` text NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reviews` ("worktree_id", "revision", "published_at", "active", "summary_html", "summary_token", "summary_secret", "diagram", "layers")
SELECT "worktree_id", "revision", "published_at", "active", "summary_html", "summary_token", "summary_secret", "diagram", "layers" FROM `reviews`
WHERE `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `reviews`;
--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_summary_token_unique` ON `reviews` (`summary_token`);
--> statement-breakpoint
CREATE TABLE `__new_reviewed_files` (
	`worktree_id` text NOT NULL,
	`path` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`worktree_id`, `path`),
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reviewed_files` ("worktree_id", "path", "fingerprint", "reviewed_at", "stale")
SELECT "worktree_id", "path", "fingerprint", "reviewed_at", "stale" FROM `reviewed_files`
WHERE `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `reviewed_files`;
--> statement-breakpoint
ALTER TABLE `__new_reviewed_files` RENAME TO `reviewed_files`;
--> statement-breakpoint
CREATE INDEX `reviewed_files_worktree` ON `reviewed_files` (`worktree_id`);
--> statement-breakpoint
CREATE TABLE `__new_reviewed_layers` (
	`worktree_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`worktree_id`, `layer_id`),
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reviewed_layers` ("worktree_id", "layer_id", "fingerprint", "reviewed_at", "stale")
SELECT "worktree_id", "layer_id", "fingerprint", "reviewed_at", "stale" FROM `reviewed_layers`
WHERE `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `reviewed_layers`;
--> statement-breakpoint
ALTER TABLE `__new_reviewed_layers` RENAME TO `reviewed_layers`;
--> statement-breakpoint
CREATE INDEX `reviewed_layers_worktree` ON `reviewed_layers` (`worktree_id`);
--> statement-breakpoint
CREATE TABLE `__new_comment_threads` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`anchor` text NOT NULL,
	`resolved` integer NOT NULL,
	`revision` integer NOT NULL,
	`last_agent_revision` integer,
	`size_bytes` integer NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comment_threads` ("sequence", "id", "worktree_id", "anchor", "resolved", "revision", "last_agent_revision", "size_bytes")
SELECT "sequence", "id", "worktree_id", "anchor", "resolved", "revision", "last_agent_revision", "size_bytes" FROM `comment_threads`
WHERE `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `comment_threads`;
--> statement-breakpoint
ALTER TABLE `__new_comment_threads` RENAME TO `comment_threads`;
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_threads_normalized_id_unique` ON `comment_threads` (`id`);
--> statement-breakpoint
CREATE INDEX `comment_threads_worktree` ON `comment_threads` (`worktree_id`);
--> statement-breakpoint
CREATE TABLE `__new_comment_messages` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`thread_id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`body` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`thread_id`) REFERENCES `comment_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comment_messages` ("sequence", "id", "thread_id", "worktree_id", "body", "author", "created_at")
SELECT "sequence", "id", "thread_id", "worktree_id", "body", "author", "created_at" FROM `comment_messages`
WHERE `thread_id` IN (SELECT `id` FROM `comment_threads`)
	AND `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `comment_messages`;
--> statement-breakpoint
ALTER TABLE `__new_comment_messages` RENAME TO `comment_messages`;
--> statement-breakpoint
CREATE INDEX `comment_messages_id` ON `comment_messages` (`id`);
--> statement-breakpoint
CREATE INDEX `comment_messages_thread` ON `comment_messages` (`thread_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `comment_messages_worktree` ON `comment_messages` (`worktree_id`);
--> statement-breakpoint
CREATE TABLE `__new_comment_reads` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`seen_through` integer NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comment_reads` ("worktree_id", "seen_through")
SELECT "worktree_id", "seen_through" FROM `comment_reads`
WHERE `worktree_id` IN (SELECT `worktree_id` FROM `worktree_presence`);
--> statement-breakpoint
DROP TABLE `comment_reads`;
--> statement-breakpoint
ALTER TABLE `__new_comment_reads` RENAME TO `comment_reads`;
