CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `artifacts_worktree` ON `artifacts` (`worktree_id`);