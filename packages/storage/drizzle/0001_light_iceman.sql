CREATE TABLE `reviewed_files` (
	`worktree_id` text NOT NULL,
	`path` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewed_at` text NOT NULL,
	PRIMARY KEY(`worktree_id`, `path`)
);
--> statement-breakpoint
CREATE INDEX `reviewed_files_worktree` ON `reviewed_files` (`worktree_id`);