CREATE TABLE `comment_threads` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_threads_id_unique` ON `comment_threads` (`id`);