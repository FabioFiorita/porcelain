PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reviewed_files` (
	`worktree_id` text NOT NULL,
	`scope` text DEFAULT 'worktree' NOT NULL,
	`path` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`worktree_id`, `scope`, `path`),
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reviewed_files`("worktree_id", "scope", "path", "fingerprint", "reviewed_at", "stale") SELECT "worktree_id", 'worktree', "path", "fingerprint", "reviewed_at", "stale" FROM `reviewed_files`;--> statement-breakpoint
DROP TABLE `reviewed_files`;--> statement-breakpoint
ALTER TABLE `__new_reviewed_files` RENAME TO `reviewed_files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `reviewed_files_worktree` ON `reviewed_files` (`worktree_id`);